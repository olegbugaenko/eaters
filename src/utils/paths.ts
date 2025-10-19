type LinePoint = { x: number; y: number; width: number };

type BuildOpts = {
  /** Extend caps slightly along the tangent to hide AA seams (px). Default: 0.2 */
  epsilon?: number;
  /** Skip segments shorter than this. Default: 1e-6 */
  minSegmentLength?: number;
  /** Quad winding: "CW" | "CCW". Default: "CCW" */
  winding?: "CW" | "CCW";
};

type Vec = { x: number; y: number };

// ----- vector helpers -----
const vAdd = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const vSub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const vMul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const vLen = (a: Vec): number => Math.hypot(a.x, a.y);
const vNorm = (a: Vec): Vec => {
  const L = vLen(a);
  return L > 0 ? { x: a.x / L, y: a.y / L } : { x: 0, y: 0 };
};
const vPerp = (t: Vec): Vec => ({ x: -t.y, y: t.x });
const vDot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;

/**
 * Compute per-point normals (mitered) for a polyline with variable width.
 * For endpoints: use the adjacent segment's normal.
 * For joints: normalized average of adjacent segment normals; if segments are nearly opposite, fall back to one.
 */
function computePointNormals(path: LinePoint[]): Vec[] {
  const n = path.length;
  if (n < 2) return [];

  // segment tangents and normals
  const segT: Vec[] = [];
  const segN: Vec[] = [];
  for (let i = 0; i < n - 1; i++) {
    const t = vNorm(vSub(path[i + 1]!, path[i]!));
    segT.push(t);
    segN.push(vPerp(t)); // left-hand normal
  }

  const pointN: Vec[] = new Array(n);
  pointN[0] = segN[0]!;
  pointN[n - 1] = segN[n - 2]!;

  for (let i = 1; i < n - 1; i++) {
    const nPrev = segN[i - 1]!;
    const nNext = segN[i]!;
    const tPrev = segT[i - 1]!;
    const tNext = segT[i]!;

    // if nearly colinear but opposite, pick the bigger-weight normal to avoid degeneracy
    if (vDot(tPrev, tNext) < -0.99) {
      pointN[i] = nNext; // or nPrev — both ok; choose next for forward continuity
    } else {
      const nSum = vAdd(nPrev, nNext);
      const L = vLen(nSum);
      pointN[i] = L > 1e-6 ? vMul(nSum, 1 / L) : nNext;
    }
  }
  return pointN;
}

/**
 * Build variable-width quad list along a polyline.
 * Returns quads as arrays of 4 vertices: [leftStart, leftEnd, rightEnd, rightStart]
 */
export function buildPolygonsByLine(
  path: LinePoint[],
  opts: BuildOpts = {}
): Array<Array<{ x: number; y: number }>> {
  const { epsilon = 0.2, minSegmentLength = 1e-6, winding = "CCW" } = opts;

  if (!path || path.length < 2) return [];

  // precompute miters at each path point
  const pointN = computePointNormals(path);
  const quads: Array<Array<{ x: number; y: number }>> = [];

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;

    // segment tangent
    const t = vNorm(vSub(b, a));
    if (!isFinite(t.x) || !isFinite(t.y)) continue;

    // skip degenerate
    const segLen = vLen(vSub(b, a));
    if (segLen < minSegmentLength) continue;

    // epsilon caps along tangent to reduce visual seams
    const aCap = vSub(a, vMul(t, epsilon));
    const bCap = vAdd(b, vMul(t, epsilon));

    // per-end half-widths
    const wa = (a.width ?? 0) * 0.5;
    const wb = (b.width ?? 0) * 0.5;

    // normals at ends (mitered / averaged)
    const na = pointN[i]!;
    const nb = pointN[i + 1]!;

    // construct the four corners
    const aL = vAdd(aCap, vMul(na, wa));
    const aR = vSub(aCap, vMul(na, wa));
    const bL = vAdd(bCap, vMul(nb, wb));
    const bR = vSub(bCap, vMul(nb, wb));

    let quad = [aL, bL, bR, aR];

    // enforce winding if needed
    if (winding === "CW") {
      quad = [aR, bR, bL, aL];
    }

    quads.push(quad);
  }

  return quads;
}

/**
 * Wrapper: map polyline to polygon shapes for your renderer.
 * Example shape record matches { shape: "polygon", vertices, ...options }.
 */
export function mapLineToPolygonShape<
  T extends Record<string, any> = Record<string, any>
>(
  path: LinePoint[],
  options: T,
  opts?: BuildOpts
): Array<
  T & {
    shape: "polygon";
    vertices: Array<{ x: number; y: number }>;
    // meta to support animation
    spine: LinePoint[];
    segmentIndex: number;
    buildOpts: BuildOpts;
  }
> {
  const quads = buildPolygonsByLine(path, opts);
  return quads.map((vertices, index) => ({
    shape: "polygon",
    vertices,
    spine: path.map((p) => ({ x: p.x, y: p.y, width: p.width })),
    segmentIndex: index,
    buildOpts: { ...opts },
    ...options,
  }));
}
