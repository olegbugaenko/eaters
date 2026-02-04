import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnimationConfig } from "@shared/types/renderer.types";

const TAU = Math.PI * 2;

export type AnimationTimeSource = () => number;

export type AnimationExecutionMode = "gpu" | "cpu";

const warnedFallbacks = new Set<string>();

export const resolveAnimationExecutionMode = (options: {
  requested?: RendererLayerAnimationConfig["executionMode"];
  gpuAvailable: boolean;
  warnKey?: string;
}): AnimationExecutionMode => {
  const requested = options.requested ?? "gpu";
  if (requested === "cpu") {
    return "cpu";
  }
  if (options.gpuAvailable) {
    return "gpu";
  }
  const warnKey = options.warnKey ?? "default";
  if (!warnedFallbacks.has(warnKey)) {
    warnedFallbacks.add(warnKey);
    console.warn(
      `[AnimationPipeline] GPU mode requested but unavailable; falling back to CPU for ${warnKey}.`
    );
  }
  return "cpu";
};

export type SpinePoint = { x: number; y: number; width: number };

export type SpineBuildOptions = {
  epsilon?: number;
  minSegmentLength?: number;
  winding?: "CW" | "CCW";
};

export type SpineSwaySampler = {
  getVertices: () => SceneVector2[];
  getDeformedSpine: () => SpinePoint[];
};

export const createSpineSwaySampler = (options: {
  spine: SpinePoint[];
  segmentIndex: number;
  buildOpts: SpineBuildOptions | undefined;
  anim: RendererLayerAnimationConfig;
  timeSource: AnimationTimeSource;
}): SpineSwaySampler => {
  const baseSpine = options.spine.map((p) => ({ x: p.x, y: p.y, width: p.width }));
  const segIndex = options.segmentIndex;
  const build = options.buildOpts ?? {};
  const winding = build.winding === "CW" ? "CW" : "CCW";
  const epsilon = typeof build.epsilon === "number" && isFinite(build.epsilon) ? build.epsilon : 0.2;
  const anim = options.anim;
  const period = Math.max(anim.periodMs ?? 1400, 1);
  const amplitude = anim.amplitude ?? 1.0;
  const phase = anim.phase ?? 0;
  const falloffKind = anim.falloff ?? "tip";
  const axis = anim.axis ?? "normal";

  const segmentCount = Math.max(baseSpine.length - 1, 0);
  const deformed = baseSpine.map((p) => ({ x: p.x, y: p.y, width: p.width }));
  const quadVerts: SceneVector2[] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];

  const falloffFactors = new Float32Array(baseSpine.length);
  if (baseSpine.length > 1) {
    for (let i = 1; i < baseSpine.length; i += 1) {
      const ratio = i / (baseSpine.length - 1);
      falloffFactors[i] =
        falloffKind === "tip"
          ? ratio
          : falloffKind === "root"
          ? 1 - ratio
          : 1;
    }
  }

  const axisX = new Float32Array(segmentCount);
  const axisY = new Float32Array(segmentCount);
  for (let i = 0; i < segmentCount; i += 1) {
    const a = baseSpine[i]!;
    const b = baseSpine[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const tangentX = dx / length;
    const tangentY = dy / length;
    const normalX = -tangentY;
    const normalY = tangentX;
    axisX[i] = axis === "tangent" ? tangentX : normalX;
    axisY[i] = axis === "tangent" ? tangentY : normalY;
  }

  const omega = (2 * Math.PI) / period;

  const deformSpine = (timeMs: number) => {
    if (baseSpine.length === 0) {
      return;
    }
    deformed[0]!.x = baseSpine[0]!.x;
    deformed[0]!.y = baseSpine[0]!.y;
    if (baseSpine.length === 1 || amplitude === 0 || segmentCount === 0) {
      for (let i = 1; i < baseSpine.length; i += 1) {
        deformed[i]!.x = baseSpine[i]!.x;
        deformed[i]!.y = baseSpine[i]!.y;
      }
      return;
    }

    const baseAngle = omega * timeMs + phase;

    for (let i = 1; i < baseSpine.length; i += 1) {
      const segmentPhase = i * 0.5;
      const sinAngle = Math.sin(baseAngle + segmentPhase);
      const displacement = amplitude * falloffFactors[i]! * sinAngle;
      const axisXValue = axisX[i - 1] ?? 0;
      const axisYValue = axisY[i - 1] ?? 0;
      deformed[i]!.x = baseSpine[i]!.x + axisXValue * displacement;
      deformed[i]!.y = baseSpine[i]!.y + axisYValue * displacement;
    }
  };

  const buildQuad = (k: number) => {
    const a = deformed[k]!;
    const b = deformed[k + 1]!;
    const ax = a?.x ?? 0;
    const ay = a?.y ?? 0;
    const bx = b?.x ?? ax;
    const by = b?.y ?? ay;
    const tx = bx - ax;
    const ty = by - ay;
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    const nx = -uy;
    const ny = ux;
    const aCapX = ax - ux * epsilon;
    const aCapY = ay - uy * epsilon;
    const bCapX = bx + ux * epsilon;
    const bCapY = by + uy * epsilon;
    const wa = (a?.width ?? 0) * 0.5;
    const wb = (b?.width ?? 0) * 0.5;
    const aLx = aCapX + nx * wa;
    const aLy = aCapY + ny * wa;
    const aRx = aCapX - nx * wa;
    const aRy = aCapY - ny * wa;
    const bLx = bCapX + nx * wb;
    const bLy = bCapY + ny * wb;
    const bRx = bCapX - nx * wb;
    const bRy = bCapY - ny * wb;
    if (winding === "CW") {
      quadVerts[0]!.x = aRx;
      quadVerts[0]!.y = aRy;
      quadVerts[1]!.x = bRx;
      quadVerts[1]!.y = bRy;
      quadVerts[2]!.x = bLx;
      quadVerts[2]!.y = bLy;
      quadVerts[3]!.x = aLx;
      quadVerts[3]!.y = aLy;
    } else {
      quadVerts[0]!.x = aLx;
      quadVerts[0]!.y = aLy;
      quadVerts[1]!.x = bLx;
      quadVerts[1]!.y = bLy;
      quadVerts[2]!.x = bRx;
      quadVerts[2]!.y = bRy;
      quadVerts[3]!.x = aRx;
      quadVerts[3]!.y = aRy;
    }
  };

  const sampleVertices = (() => {
    let lastSampleTime = -1;
    const UPDATE_INTERVAL_MS = 32;
    return () => {
      const now = options.timeSource();
      if (now - lastSampleTime < UPDATE_INTERVAL_MS) {
        return quadVerts;
      }
      lastSampleTime = now;
      deformSpine(now);
      buildQuad(segIndex);
      return quadVerts;
    };
  })();

  return {
    getVertices: sampleVertices,
    getDeformedSpine: () => deformed,
  };
};

export type PolygonAnimSampler = {
  getVertices: () => SceneVector2[];
  getDeformedVertices: () => SceneVector2[];
};

export const createPolygonAnimSampler = (options: {
  vertices: SceneVector2[];
  anim: RendererLayerAnimationConfig;
  timeSource: AnimationTimeSource;
  enableMovementAxis?: boolean;
  phaseStep?: number;
}): PolygonAnimSampler => {
  const baseVertices = options.vertices.map((v) => ({ x: v.x, y: v.y }));
  const center = baseVertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  const invCount = baseVertices.length > 0 ? 1 / baseVertices.length : 0;
  center.x *= invCount;
  center.y *= invCount;

  const animCfg = options.anim;
  const period = Math.max(1, Math.floor(animCfg.periodMs ?? 1500));
  const amplitude = animCfg.amplitude ?? 6;
  const phase = animCfg.phase ?? 0;
  const axis = animCfg.axis ?? "normal";
  const amplitudePercentage =
    typeof animCfg.amplitudePercentage === "number" && Number.isFinite(animCfg.amplitudePercentage)
      ? animCfg.amplitudePercentage
      : undefined;
  const movementPerp =
    options.enableMovementAxis && axis === "movement-tangent"
      ? { x: 0, y: 1 }
      : options.enableMovementAxis && axis === "movement-normal"
      ? { x: -1, y: 0 }
      : null;

  const vertexCount = baseVertices.length;
  const baseX = new Float32Array(vertexCount);
  const baseY = new Float32Array(vertexCount);
  const normalX = new Float32Array(vertexCount);
  const normalY = new Float32Array(vertexCount);
  const tangentX = new Float32Array(vertexCount);
  const tangentY = new Float32Array(vertexCount);
  const normalMagnitude = new Float32Array(vertexCount);
  const tangentMagnitude = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i += 1) {
    const v = baseVertices[i]!;
    const dx = v.x - center.x;
    const dy = v.y - center.y;
    const radius = Math.hypot(dx, dy);
    const invRadius = radius > 1e-6 ? 1 / radius : 0;
    baseX[i] = v.x;
    baseY[i] = v.y;
    normalX[i] = dx * invRadius;
    normalY[i] = dy * invRadius;
    tangentX[i] = -normalY[i]!;
    tangentY[i] = normalX[i]!;
    normalMagnitude[i] = amplitudePercentage !== undefined ? radius * amplitudePercentage : amplitude;
    tangentMagnitude[i] = amplitude;
  }
  const deformed = baseVertices.map((v) => ({ x: v.x, y: v.y }));
  const moveToward = movementPerp ? new Float32Array(vertexCount) : null;
  const moveMagnitude = movementPerp ? new Float32Array(vertexCount) : null;
  if (movementPerp && moveToward && moveMagnitude) {
    for (let i = 0; i < vertexCount; i += 1) {
      const signedDist = baseX[i]! * movementPerp.x + baseY[i]! * movementPerp.y;
      moveToward[i] = -Math.sign(signedDist) || 0;
      moveMagnitude[i] =
        amplitudePercentage !== undefined ? Math.abs(signedDist) * amplitudePercentage : amplitude;
    }
  }
  const hasMovement = Boolean(movementPerp && moveToward && moveMagnitude);
  const phaseStep = options.phaseStep ?? 0.3;
  const sinPhaseStep = Math.sin(phaseStep);
  const cosPhaseStep = Math.cos(phaseStep);

  const sampleSway = (timeMs: number): SceneVector2[] => {
    if (vertexCount === 0) {
      return deformed;
    }
    const omega = TAU / period;
    const baseAngle = omega * timeMs + phase;
    const globalSin = Math.sin(baseAngle);
    const usesVertexPhase = !hasMovement;
    const sinStep = usesVertexPhase ? sinPhaseStep : 0;
    const cosStep = usesVertexPhase ? cosPhaseStep : 1;
    let sinValue = globalSin;
    let cosValue = Math.cos(baseAngle);
    for (let i = 0; i < vertexCount; i += 1) {
      const sinForVertex = usesVertexPhase ? sinValue : globalSin;
      if (movementPerp && moveToward && moveMagnitude && hasMovement) {
        const magnitude = moveMagnitude[i]! * sinForVertex * moveToward[i]!;
        deformed[i]!.x = baseX[i]! + movementPerp.x * magnitude;
        deformed[i]!.y = baseY[i]! + movementPerp.y * magnitude;
      } else if (axis === "tangent") {
        const magnitude = tangentMagnitude[i]! * sinForVertex;
        deformed[i]!.x = baseX[i]! + tangentX[i]! * magnitude;
        deformed[i]!.y = baseY[i]! + tangentY[i]! * magnitude;
      } else {
        const magnitude = normalMagnitude[i]! * sinForVertex;
        deformed[i]!.x = baseX[i]! + normalX[i]! * magnitude;
        deformed[i]!.y = baseY[i]! + normalY[i]! * magnitude;
      }
      if (usesVertexPhase) {
        const prevSin = sinValue;
        const prevCos = cosValue;
        sinValue = prevSin * cosStep + prevCos * sinStep;
        cosValue = prevCos * cosStep - prevSin * sinStep;
      }
    }
    return deformed;
  };

  const samplePulse = (timeMs: number): SceneVector2[] => {
    if (vertexCount === 0) {
      return deformed;
    }
    const omega = TAU / period;
    const baseAngle = omega * timeMs + phase;
    let sinValue = Math.sin(baseAngle);
    for (let i = 0; i < vertexCount; i += 1) {
      const s = sinValue;
      if (movementPerp && moveToward && moveMagnitude) {
        const magnitude = moveMagnitude[i]! * s * moveToward[i]!;
        deformed[i]!.x = baseX[i]! + movementPerp.x * magnitude;
        deformed[i]!.y = baseY[i]! + movementPerp.y * magnitude;
      } else if (axis === "tangent") {
        const magnitude = amplitude * s;
        deformed[i]!.x = baseX[i]! + tangentX[i]! * magnitude;
        deformed[i]!.y = baseY[i]! + tangentY[i]! * magnitude;
      } else {
        const magnitude = amplitude * s;
        deformed[i]!.x = baseX[i]! + normalX[i]! * magnitude;
        deformed[i]!.y = baseY[i]! + normalY[i]! * magnitude;
      }
    }
    return deformed;
  };

  const getDeformedVertices = (() => {
    const UPDATE_INTERVAL_MS = 32;
    let lastUpdateTime = -1;
    return () => {
      const now = options.timeSource();
      if (now - lastUpdateTime < UPDATE_INTERVAL_MS) {
        return deformed;
      }
      lastUpdateTime = now;
      if (animCfg.type === "sway") {
        sampleSway(now);
      } else {
        samplePulse(now);
      }
      return deformed;
    };
  })();

  return {
    getVertices: () => getDeformedVertices(),
    getDeformedVertices: () => deformed,
  };
};
