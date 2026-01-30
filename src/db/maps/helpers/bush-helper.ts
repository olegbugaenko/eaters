import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BrickShapeBlueprint } from "../../../logic/services/brick-layout/BrickLayoutService";
import { bezierCurveWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { BezierSegment, CurveParams } from "../../../logic/services/brick-layout/brick-layout.types";

/**
 * ✅ TUNABLE CONSTANTS (your request)
 * STEP = 3 means: total slots per side = STEP * N
 * MIN_FREE_SLOTS = 1 means: at least 1 empty slot between neighboring branches (=> +2 spacing)
 */
const BRANCH_SLOT_STEP = 3;
const BRANCH_MIN_FREE_SLOTS = 2;

const vAdd = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({ x: a.x + b.x, y: a.y + b.y });
const vSub = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({ x: a.x - b.x, y: a.y - b.y });
const vMul = (a: SceneVector2, k: number): SceneVector2 => ({ x: a.x * k, y: a.y * k });
const vLen = (a: SceneVector2): number => Math.hypot(a.x, a.y);
const vNorm = (a: SceneVector2): SceneVector2 => {
  const l = vLen(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
};
const vLerp = (a: SceneVector2, b: SceneVector2, t: number): SceneVector2 => vAdd(a, vMul(vSub(b, a), t));

const dir = (angleRad: number): SceneVector2 => ({ x: Math.cos(angleRad), y: Math.sin(angleRad) });
const perp = (d: SceneVector2): SceneVector2 => ({ x: -d.y, y: d.x });

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
const clamp01 = (t: number) => clamp(t, 0, 1);

function makeBezier(
  start: SceneVector2,
  angle: number,
  length: number,
  bendPx: number,
  c1t = 0.33,
  c2t = 0.72,
): readonly BezierSegment[] {
  const d = dir(angle);
  const p = perp(d);
  const end = vAdd(start, vMul(d, length));

  const c1 = vAdd(vAdd(start, vMul(d, length * c1t)), vMul(p, bendPx));
  const c2 = vAdd(vAdd(start, vMul(d, length * c2t)), vMul(p, -bendPx * 0.6));

  return [{ start, control1: c1, control2: c2, end }];
}

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const sgn = (i: number) => (i % 2 === 0 ? 1 : -1);

// deterministic “noise” (0..1 / -1..1)
const hash01 = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const signedHash = (n: number) => hash01(n) * 2 - 1;

function sideBranchDelta(
  side: "L" | "R",
  centered: number, // -1..1 within the same side
  minAngleRad: number,
  spreadRad: number,
  jitterRad: number,
  verticalBiasRad: number,
): number {
  const sign = side === "L" ? -1 : 1;

  const spreadTerm = centered * (spreadRad * 0.35);
  let magnitude = minAngleRad + spreadTerm + jitterRad + verticalBiasRad;

  magnitude = Math.max(minAngleRad, magnitude);

  const maxAngle = Math.max(minAngleRad + degToRad(10), minAngleRad + spreadRad * 0.55);
  magnitude = Math.min(magnitude, maxAngle, Math.PI / 2.4);

  return sign * magnitude;
}

function twigSignWithSharedPhase(j: number, m: number, branchTwigSeed: number): 1 | -1 {
  if (m <= 1) return (hash01(branchTwigSeed + 11.11) < 0.5 ? -1 : 1) as 1 | -1;

  const phase = hash01(branchTwigSeed + 77.7) < 0.5 ? 0 : 1;
  const isNeg = ((j + phase) % 2) === 0;
  return (isNeg ? -1 : 1) as 1 | -1;
}

/**
 * ✅ Slot-based height planner per side (NO height jitter).
 *
 * For N branches:
 * - slotsCount = STEP * N
 * - branch j may choose slot in [j*STEP .. j*STEP+(STEP-1)]
 * - and must be at least (MIN_FREE_SLOTS+1) slots above previous chosen slot.
 *
 * Returns array of t's (length N), each being the CENTER of its chosen slot.
 */
function buildSlotHeights(params: { count: number; startT: number; endT: number; seedBase: number }): number[] {
  const { count, startT, endT, seedBase } = params;
  if (count <= 0) return [];

  const span = Math.max(1e-6, endT - startT);
  const slotsCount = BRANCH_SLOT_STEP * count;
  const slotDT = span / slotsCount;

  const chosenSlots: number[] = [];
  let prev = -BRANCH_SLOT_STEP;

  const gap = BRANCH_MIN_FREE_SLOTS + 1; // +1 because adjacency already consumes 1 slot

  for (let j = 0; j < count; j++) {
    const baseLo = j * BRANCH_SLOT_STEP;
    const baseHi = j * BRANCH_SLOT_STEP + (BRANCH_SLOT_STEP - 1);

    // enforce min distance from previous
    const lo = Math.max(baseLo, prev + gap);
    const hi = baseHi;

    // If impossible (too tight), clamp to lo (still monotonic and safe)
    let slot: number;
    if (lo > hi) {
      slot = lo;
    } else {
      const r = hash01(seedBase + j * 19.19);
      slot = lo + Math.floor(r * (hi - lo + 1)); // inclusive
    }

    console.log(`slot: ${j}`, slot, lo, hi, seedBase + j * 19.19);

    chosenSlots.push(slot);
    prev = slot;
  }

  // Map slot index -> center t of that slot, clamped
  const t: number[] = [];
  for (let j = 0; j < chosenSlots.length; j++) {
    const s = chosenSlots[j]!;

    // псевдо-рандом в межах слота (0..1)
    const u01 = hash01(seedBase + 999.123 + j * 41.77);

    // щоб не липло до країв слота (опційно, але рекомендую)
    const margin = 0.18; // 18% знизу/зверху слота не використовуємо
    const u = margin + u01 * (1 - 2 * margin); // [margin..1-margin]

    const pos = (s + u) * slotDT;
    t.push(clamp(startT + pos, startT, endT));
  }

  return t;
}

export type BrickTreeParams = {
  origin: SceneVector2;
  size: number;
  upAngleRad?: number;

  topBranchesCount?: number;
  sideBranchesCount: number;
  branchingsPerSide: number;

  trunkThickness: number;
  mainBranchThickness: number;
  twigThickness: number;

  brickType: Parameters<typeof bezierCurveWithBricks>[0];
  brickLevel: number;
  spacing?: number;

  trunkLenMul?: number;
  topLenMul?: number;
  sideLenMul?: number;
  twigLenMul?: number;

  /** ✅ NEW: multiplies all side-branch lengths (applied on top of sideLenMul) */
  branchesLenMul?: number;

  /** ✅ NEW: multiplies all twig lengths (applied on top of twigLenMul) */
  twigsLenMul?: number;

  minTwigLenPx?: number;

  minSideAngleDeg?: number;
  sideSpreadRad?: number;
  topSpreadRad?: number;
  twigSpreadRad?: number;

  branchStartT?: number;
  branchEndT?: number;

  bendTrunkPx?: number;
  bendTopPx?: number;
  bendSidePx?: number;
  bendTwigPx?: number;

  balanceSides?: boolean;
  sideBias?: number;

  angleJitterRad?: number;
  lenJitter?: number;
  bendJitter?: number;
  verticalBias?: number;

  minTwigBranchAngleDeg?: number;
  maxTwigBranchAngleDeg?: number;

  twigAt?: readonly number[];

  topStartSideOffsetPx?: number;
  twigStartSideOffsetPx?: number;
};

export function brickTreeDeterministic(params: BrickTreeParams): readonly BrickShapeBlueprint[] {
  const {
    origin,
    size,
    upAngleRad = -Math.PI / 2,

    topBranchesCount = 1,
    sideBranchesCount,
    branchingsPerSide,

    trunkThickness,
    mainBranchThickness,
    twigThickness,

    brickType,
    brickLevel,
    spacing = 26,

    trunkLenMul = 1.15,
    topLenMul = 0.55,
    sideLenMul = 0.70,
    twigLenMul = 0.42,

    // ✅ NEW defaults
    branchesLenMul = 1,
    twigsLenMul = 1,

    minTwigLenPx = 80,

    minSideAngleDeg = 45,
    sideSpreadRad = Math.PI * 0.75,
    topSpreadRad = Math.PI * 0.22,
    twigSpreadRad = Math.PI * 0.55,

    branchStartT = 0.55,
    branchEndT = 0.92,

    bendTrunkPx = 22,
    bendTopPx = 10,
    bendSidePx = 18,
    bendTwigPx = 10,

    balanceSides = true,
    sideBias = 0,

    angleJitterRad = 0.22,
    lenJitter = 0.12,
    bendJitter = 0.30,
    verticalBias = 0.22,

    minTwigBranchAngleDeg = 30,
    maxTwigBranchAngleDeg = 75,

    twigAt = [0.50, 0.70, 0.84],

    topStartSideOffsetPx = 10,
    twigStartSideOffsetPx = 10,
  } = params;

  const out: BrickShapeBlueprint[] = [];

  // 1) Trunk
  const trunkLenPx = size * trunkLenMul;
  const trunkSegs = makeBezier(origin, upAngleRad, trunkLenPx, bendTrunkPx, 0.28, 0.76);
  out.push(
    bezierCurveWithBricks(
      brickType,
      { segments: trunkSegs, spacing, thickness: trunkThickness } satisfies CurveParams,
      { level: brickLevel },
    ),
  );

  const trunkEnd = trunkSegs[0]!.end;
  const trunkDir = vNorm(vSub(trunkEnd, origin));
  const trunkPerp = perp(trunkDir);

  // 2) Top branches (split sideways on trunk perpendicular)
  const topN = clamp(topBranchesCount, 0, 6);
  for (let i = 0; i < topN; i++) {
    const centered = topN <= 1 ? 0 : (i / (topN - 1)) * 2 - 1;
    const seed = 9001 + i * 17 + topN * 31;

    const angJ = signedHash(seed + 1) * (angleJitterRad * 0.35);
    const lenJ = signedHash(seed + 2) * (lenJitter * 0.35);
    const bendM = 1 + signedHash(seed + 3) * (bendJitter * 0.35);

    const angle = upAngleRad + centered * (topSpreadRad * 0.5) + sgn(i) * 0.06 + angJ;
    const len =
      Math.max(size * 0.30, size * topLenMul * (0.95 - 0.08 * Math.abs(centered))) * (1 + lenJ);
    const bend = bendTopPx * sgn(i) * (1.0 - 0.15 * (i % 3)) * bendM;

    const start = vAdd(trunkEnd, vMul(trunkPerp, centered * topStartSideOffsetPx));

    const segs = makeBezier(start, angle, len, bend, 0.30, 0.76);
    out.push(
      bezierCurveWithBricks(
        brickType,
        { segments: segs, spacing, thickness: mainBranchThickness } satisfies CurveParams,
        { level: brickLevel },
      ),
    );
  }

  // 3) Side branches
  const minSideAngle = degToRad(minSideAngleDeg);
  const sideN = clamp(sideBranchesCount, 0, 12);

  type Side = "L" | "R";
  const sides: Side[] = [];

  if (!balanceSides) {
    for (let i = 0; i < sideN; i++) sides.push(i % 2 === 0 ? "L" : "R");
  } else {
    const bias = clamp(sideBias, -1, 1);
    const biasShift = Math.round(bias * Math.min(2, sideN));
    let rightCount = Math.floor(sideN / 2) + (sideN % 2) + biasShift;
    rightCount = clamp(rightCount, 0, sideN);
    const leftCount = sideN - rightCount;

    for (let i = 0; i < leftCount; i++) sides.push("L");
    for (let i = 0; i < rightCount; i++) sides.push("R");
  }

  const leftCount = sides.filter((s) => s === "L").length;
  const rightCount = sides.length - leftCount;

  // ✅ Slot-based heights PER SIDE (independent, but same slot scheme if counts equal)
  const leftHeights = buildSlotHeights({
    count: leftCount,
    startT: branchStartT,
    endT: branchEndT,
    seedBase: 10001,
  });

  const rightHeights = buildSlotHeights({
    count: rightCount,
    startT: branchStartT,
    endT: branchEndT,
    seedBase: 20001,
  });

  let leftK = 0;
  let rightK = 0;

  for (let i = 0; i < sides.length; i++) {
    const side = sides[i]!;
    const k = side === "L" ? leftK++ : rightK++;
    const count = side === "L" ? leftCount : rightCount;

    const sideSeed = side === "L" ? 101 : 203;
    const seed = sideSeed + k * 17 + sideN * 31;

    const heightT = (side === "L" ? leftHeights[k] : rightHeights[k]) ?? (branchStartT + 0.2);
    const sideStart = vLerp(origin, trunkEnd, heightT);

    const centered = count <= 1 ? 0 : (k / (count - 1)) * 2 - 1;

    const v = clamp01((heightT - branchStartT) / Math.max(1e-6, branchEndT - branchStartT));
    const vBiasRad = (v - 0.5) * verticalBias;

    const angJ = signedHash(seed + 2) * angleJitterRad;

    const delta = sideBranchDelta(side, centered, minSideAngle, sideSpreadRad, angJ, vBiasRad);
    const sideAngle = upAngleRad + delta;

    const lenJ = signedHash(seed + 3) * lenJitter;

    // ✅ NEW: apply branchesLenMul on top of sideLenMul
    const sideLen =
      size *
      sideLenMul *
      branchesLenMul *
      (0.95 - 0.10 * Math.abs(centered)) *
      (1 + lenJ);

    const bendM = 1 + signedHash(seed + 4) * bendJitter;
    const sideBend = bendSidePx * (side === "L" ? -1 : 1) * (0.90 - 0.10 * (k % 3)) * bendM;

    const sideSegs = makeBezier(sideStart, sideAngle, sideLen, sideBend);
    out.push(
      bezierCurveWithBricks(
        brickType,
        { segments: sideSegs, spacing, thickness: mainBranchThickness } satisfies CurveParams,
        { level: brickLevel },
      ),
    );

    // 4) Twigs
    const m = clamp(branchingsPerSide, 0, 10);
    const sideEnd = sideSegs[0]!.end;

    const minA = degToRad(minTwigBranchAngleDeg);
    const maxA = degToRad(maxTwigBranchAngleDeg);

    const branchTwigSeed = seed * 13 + 555;

    const parentDir = vNorm(vSub(sideEnd, sideStart));
    const parentPerp = perp(parentDir);
    const parentAngle = Math.atan2(parentDir.y, parentDir.x);

    const overlapPx = Math.min(6, twigStartSideOffsetPx * 0.4);

    for (let j = 0; j < m; j++) {
      const tj = twigAt[(j + i) % twigAt.length]!;
      const twigStartCenter = vLerp(sideStart, sideEnd, tj);

      const twigCentered = m <= 1 ? 0 : (j / (m - 1)) * 2 - 1;

      const twigSeed = branchTwigSeed + j * 7;

      const twigAngJ = signedHash(twigSeed + 1) * (angleJitterRad * 0.55);
      const twigLenJ = signedHash(twigSeed + 2) * (lenJitter * 0.65);
      const twigBendM = 1 + signedHash(twigSeed + 3) * (bendJitter * 0.55);

      const desiredRel =
        twigCentered * (twigSpreadRad * 0.5) +
        sgn(i + j) * (0.10 + 0.03 * (k % 4)) +
        twigAngJ;

      const mag = clamp(Math.abs(desiredRel), minA, maxA);

      const sign = twigSignWithSharedPhase(j, m, branchTwigSeed);
      const rel = sign * mag;

      const twigAngle = parentAngle + rel;

      const twigStart = vAdd(
        vAdd(twigStartCenter, vMul(parentPerp, sign * twigStartSideOffsetPx)),
        vMul(parentDir, -overlapPx),
      );

      // ✅ NEW: apply twigsLenMul on top of twigLenMul (before clamp)
      const rawTwigLen =
        size *
        twigLenMul *
        twigsLenMul *
        (0.95 - 0.10 * Math.abs(twigCentered) - 0.06 * (j % 3));

      const twigLen = Math.max(minTwigLenPx, rawTwigLen * (1 + twigLenJ));

      const twigBend = bendTwigPx * sign * (1.0 - 0.18 * (j % 3)) * twigBendM;

      const twigSegs = makeBezier(twigStart, twigAngle, twigLen, twigBend, 0.30, 0.74);

      out.push(
        bezierCurveWithBricks(
          brickType,
          { segments: twigSegs, spacing, thickness: twigThickness } satisfies CurveParams,
          { level: brickLevel },
        ),
      );
    }
  }

  return out;
}
