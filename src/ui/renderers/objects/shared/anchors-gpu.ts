import type { SceneObjectInstance, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { RendererLayerAnchorConfig, RendererLayerAnimationConfig } from "@shared/types/renderer.types";
import { getAnimationGpuContext } from "@ui/renderers/objects/shared/animation-gpu";
import { compileShader } from "@ui/renderers/utils/webglProgram";
import { DynamicPrimitive } from "@ui/renderers/objects/ObjectRenderer";
import { getSceneTimelineNow } from "@ui/renderers/primitives/utils/sceneTimeline";

const TF_VERTEX_HEADER = `#version 300 es
precision highp float;
`;

const TF_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(0.0);
}
`;

const POLYGON_ANCHOR_TF_VERTEX_SHADER = `${TF_VERTEX_HEADER}
layout(location = 0) in vec2 a_position;
layout(location = 1) in float a_vertexIndex;

uniform float u_timeMs;
uniform float u_periodMs;
uniform float u_phase;
uniform float u_amplitude;
uniform float u_amplitudePercent;
uniform float u_phaseStep;
uniform int u_animType; // 0 sway, 1 pulse
uniform int u_axisType; // 0 normal, 1 tangent, 2 movement
uniform int u_useVertexPhase;
uniform vec2 u_center;
uniform vec2 u_movementPerp;
uniform vec2 u_offset;

out vec2 v_position;

vec2 resolveNormal(vec2 pos) {
  vec2 d = pos - u_center;
  float len = length(d);
  if (len < 1e-6) {
    return vec2(0.0, 0.0);
  }
  return d / len;
}

void main() {
  vec2 basePos = a_position;
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float phaseOffset = (u_useVertexPhase == 1) ? (u_phaseStep * a_vertexIndex) : 0.0;
  float angle = baseAngle + phaseOffset;
  float s = sin(angle);

  vec2 normal = resolveNormal(basePos);
  vec2 tangent = vec2(-normal.y, normal.x);
  vec2 axis;
  if (u_axisType == 1) {
    axis = tangent;
  } else if (u_axisType == 2) {
    axis = u_movementPerp;
  } else {
    axis = normal;
  }

  float magnitude = u_amplitude;
  if (u_axisType == 2) {
    float signedDist = dot(basePos, u_movementPerp);
    float moveToward = -sign(signedDist);
    float moveMagnitude = (u_amplitudePercent >= 0.0) ? abs(signedDist) * u_amplitudePercent : u_amplitude;
    magnitude = moveMagnitude * moveToward;
  } else if (u_amplitudePercent >= 0.0 && u_axisType == 0) {
    float radius = length(basePos - u_center);
    magnitude = radius * u_amplitudePercent;
  }

  vec2 offset = axis * (magnitude * s);
  v_position = basePos + offset + u_offset;
}
`;

const SPINE_ANCHOR_TF_VERTEX_SHADER = `${TF_VERTEX_HEADER}
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_axis;
layout(location = 2) in float a_falloff;
layout(location = 3) in float a_pointIndex;

uniform float u_timeMs;
uniform float u_periodMs;
uniform float u_phase;
uniform float u_amplitude;
uniform vec2 u_offset;

out vec2 v_position;

void main() {
  float omega = 6.28318530718 / max(u_periodMs, 1.0);
  float baseAngle = omega * u_timeMs + u_phase;
  float segmentPhase = a_pointIndex * 0.5;
  float s = sin(baseAngle + segmentPhase);
  float displacement = u_amplitude * a_falloff * s;
  v_position = a_position + a_axis * displacement + u_offset;
}
`;

const TF_VARYINGS = ["v_position"] as const;

type AnchorSlotRecord = {
  baseIndex: number;
  ids: string[];
};

type PolygonAnchorUniforms = {
  timeMs: WebGLUniformLocation | null;
  periodMs: WebGLUniformLocation | null;
  phase: WebGLUniformLocation | null;
  amplitude: WebGLUniformLocation | null;
  amplitudePercent: WebGLUniformLocation | null;
  phaseStep: WebGLUniformLocation | null;
  animType: WebGLUniformLocation | null;
  axisType: WebGLUniformLocation | null;
  useVertexPhase: WebGLUniformLocation | null;
  center: WebGLUniformLocation | null;
  movementPerp: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
};

type SpineAnchorUniforms = {
  timeMs: WebGLUniformLocation | null;
  periodMs: WebGLUniformLocation | null;
  phase: WebGLUniformLocation | null;
  amplitude: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
};

type AnchorGpuProgram<TUniforms> = {
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  transformFeedback: WebGLTransformFeedback;
  uniforms: TUniforms;
};

type AnchorGpuResources = {
  anchorBuffer: WebGLBuffer;
  capacity: number;
  texture: WebGLTexture | null;
  textureSize: number;
  polygon: AnchorGpuProgram<PolygonAnchorUniforms>;
  spine: AnchorGpuProgram<SpineAnchorUniforms>;
};

const rendererContexts = new WeakMap<WebGL2RenderingContext, AnchorGpuResources>();
const failedContexts = new WeakSet<WebGL2RenderingContext>();
const warnedGpuTexture = new WeakSet<WebGL2RenderingContext>();

const anchorRegistry = new Map<string, AnchorSlotRecord>();
const freeRanges: Array<{ start: number; count: number }> = [];
let nextIndex = 0;

const normalizeGroupId = (groupId: string | undefined): string => groupId ?? "default";
const buildRegistryKey = (instanceId: string, groupId: string | undefined): string =>
  `${instanceId}::${normalizeGroupId(groupId)}`;

const createTransformFeedbackProgram = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  varyings: readonly string[]
): { program: WebGLProgram; vertexShader: WebGLShader; fragmentShader: WebGLShader } => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, TF_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link program: ${info ?? "unknown"}`);
  }
  return { program, vertexShader, fragmentShader };
};

const ensureResources = (gl: WebGL2RenderingContext): AnchorGpuResources | null => {
  const existing = rendererContexts.get(gl);
  if (existing) {
    return existing;
  }
  if (failedContexts.has(gl)) {
    return null;
  }
  try {
    const polygonProgram = createTransformFeedbackProgram(gl, POLYGON_ANCHOR_TF_VERTEX_SHADER, TF_VARYINGS);
    const spineProgram = createTransformFeedbackProgram(gl, SPINE_ANCHOR_TF_VERTEX_SHADER, TF_VARYINGS);

    const polygonTf = gl.createTransformFeedback();
    const spineTf = gl.createTransformFeedback();
    const anchorBuffer = gl.createBuffer();
    if (!polygonTf || !spineTf || !anchorBuffer) {
      return null;
    }

    const polygon: AnchorGpuProgram<PolygonAnchorUniforms> = {
      program: polygonProgram.program,
      vertexShader: polygonProgram.vertexShader,
      fragmentShader: polygonProgram.fragmentShader,
      transformFeedback: polygonTf,
      uniforms: {
        timeMs: gl.getUniformLocation(polygonProgram.program, "u_timeMs"),
        periodMs: gl.getUniformLocation(polygonProgram.program, "u_periodMs"),
        phase: gl.getUniformLocation(polygonProgram.program, "u_phase"),
        amplitude: gl.getUniformLocation(polygonProgram.program, "u_amplitude"),
        amplitudePercent: gl.getUniformLocation(polygonProgram.program, "u_amplitudePercent"),
        phaseStep: gl.getUniformLocation(polygonProgram.program, "u_phaseStep"),
        animType: gl.getUniformLocation(polygonProgram.program, "u_animType"),
        axisType: gl.getUniformLocation(polygonProgram.program, "u_axisType"),
        useVertexPhase: gl.getUniformLocation(polygonProgram.program, "u_useVertexPhase"),
        center: gl.getUniformLocation(polygonProgram.program, "u_center"),
        movementPerp: gl.getUniformLocation(polygonProgram.program, "u_movementPerp"),
        offset: gl.getUniformLocation(polygonProgram.program, "u_offset"),
      },
    };

    const spine: AnchorGpuProgram<SpineAnchorUniforms> = {
      program: spineProgram.program,
      vertexShader: spineProgram.vertexShader,
      fragmentShader: spineProgram.fragmentShader,
      transformFeedback: spineTf,
      uniforms: {
        timeMs: gl.getUniformLocation(spineProgram.program, "u_timeMs"),
        periodMs: gl.getUniformLocation(spineProgram.program, "u_periodMs"),
        phase: gl.getUniformLocation(spineProgram.program, "u_phase"),
        amplitude: gl.getUniformLocation(spineProgram.program, "u_amplitude"),
        offset: gl.getUniformLocation(spineProgram.program, "u_offset"),
      },
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, anchorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 8 * 2 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const resources: AnchorGpuResources = {
      anchorBuffer,
      capacity: 8,
      texture: null,
      textureSize: 0,
      polygon,
      spine,
    };
    rendererContexts.set(gl, resources);
    return resources;
  } catch (error) {
    console.warn("[AnchorsGpu] Failed to initialize GPU anchor resources", error);
    failedContexts.add(gl);
    return null;
  }
};

const ensureAnchorCapacity = (
  gl: WebGL2RenderingContext,
  resources: AnchorGpuResources,
  needed: number
): void => {
  if (needed <= resources.capacity) {
    return;
  }
  resources.capacity = Math.max(needed, resources.capacity * 2, 16);
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.anchorBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    resources.capacity * 2 * Float32Array.BYTES_PER_ELEMENT,
    gl.DYNAMIC_DRAW
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

const allocateAnchorRange = (count: number): number => {
  if (count <= 0) {
    return -1;
  }
  for (let i = 0; i < freeRanges.length; i += 1) {
    const range = freeRanges[i]!;
    if (range.count >= count) {
      const start = range.start;
      if (range.count === count) {
        freeRanges.splice(i, 1);
      } else {
        range.start += count;
        range.count -= count;
      }
      return start;
    }
  }
  const start = nextIndex;
  nextIndex += count;
  return start;
};

const releaseAnchorRange = (start: number, count: number): void => {
  if (count <= 0 || start < 0) {
    return;
  }
  freeRanges.push({ start, count });
  freeRanges.sort((a, b) => a.start - b.start);
  for (let i = 0; i < freeRanges.length - 1; ) {
    const current = freeRanges[i]!;
    const next = freeRanges[i + 1]!;
    if (current.start + current.count === next.start) {
      current.count += next.count;
      freeRanges.splice(i + 1, 1);
      continue;
    }
    i += 1;
  }
};

export const registerGpuAnchors = (options: {
  instanceId: string;
  groupId: string | undefined;
  anchors: RendererLayerAnchorConfig[];
}): AnchorSlotRecord | null => {
  const validAnchors = options.anchors.filter((anchor) => anchor.id);
  if (validAnchors.length === 0) {
    return null;
  }
  const key = buildRegistryKey(options.instanceId, options.groupId);
  const existing = anchorRegistry.get(key);
  if (existing && existing.ids.length === validAnchors.length) {
    const sameIds = existing.ids.every((id, index) => id === validAnchors[index]?.id);
    if (sameIds) {
      return existing;
    }
  }
  if (existing) {
    releaseAnchorRange(existing.baseIndex, existing.ids.length);
  }
  const baseIndex = allocateAnchorRange(validAnchors.length);
  const record: AnchorSlotRecord = {
    baseIndex,
    ids: validAnchors.map((anchor) => anchor.id),
  };
  anchorRegistry.set(key, record);
  return record;
};

export const releaseGpuAnchors = (instanceId: string, groupId: string | undefined): void => {
  const key = buildRegistryKey(instanceId, groupId);
  const record = anchorRegistry.get(key);
  if (!record) {
    return;
  }
  releaseAnchorRange(record.baseIndex, record.ids.length);
  anchorRegistry.delete(key);
};

export const getGpuAnchorIndex = (
  instanceId: string,
  groupId: string | undefined,
  anchorId: string
): number | null => {
  const record = anchorRegistry.get(buildRegistryKey(instanceId, groupId));
  if (!record) {
    return null;
  }
  const idx = record.ids.indexOf(anchorId);
  if (idx === -1) {
    return null;
  }
  return record.baseIndex + idx;
};

const buildPolygonAnchorInputs = (
  anchors: RendererLayerAnchorConfig[],
  vertices: SceneVector2[]
): { data: Float32Array; ids: string[] } | null => {
  const inputs: number[] = [];
  const ids: string[] = [];
  anchors.forEach((anchor) => {
    if (anchor.mode !== "vertex" || typeof anchor.index !== "number") {
      return;
    }
    const vertex = vertices[anchor.index];
    if (!vertex) {
      return;
    }
    inputs.push(vertex.x, vertex.y, anchor.index);
    ids.push(anchor.id);
  });
  if (ids.length === 0) {
    return null;
  }
  return { data: new Float32Array(inputs), ids };
};

type SpineAnchorInput = {
  data: Float32Array;
  ids: string[];
};

const buildSpineAnchors = (
  anchors: RendererLayerAnchorConfig[],
  spine: Array<{ x: number; y: number; width: number }>,
  anim: RendererLayerAnimationConfig
): SpineAnchorInput | null => {
  if (spine.length === 0) {
    return null;
  }
  const falloffKind = anim.falloff ?? "tip";
  const falloffFactors = new Float32Array(spine.length);
  if (spine.length > 1) {
    for (let i = 1; i < spine.length; i += 1) {
      const ratio = i / (spine.length - 1);
      falloffFactors[i] =
        falloffKind === "tip"
          ? ratio
          : falloffKind === "root"
          ? 1 - ratio
          : 1;
    }
  }

  const segmentCount = Math.max(spine.length - 1, 0);
  const axis = anim.axis ?? "normal";
  const axisX = new Float32Array(segmentCount);
  const axisY = new Float32Array(segmentCount);
  for (let i = 0; i < segmentCount; i += 1) {
    const a = spine[i]!;
    const b = spine[i + 1]!;
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

  const resolvePointByT = (t: number): { position: SceneVector2; segmentIndex: number; pointIndex: number } => {
    if (spine.length === 1) {
      return { position: spine[0]!, segmentIndex: 0, pointIndex: 0 };
    }
    const clampedT = Math.max(0, Math.min(1, t));
    let totalLength = 0;
    const lengths = new Array<number>(spine.length - 1);
    for (let i = 0; i < spine.length - 1; i += 1) {
      const a = spine[i]!;
      const b = spine[i + 1]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      lengths[i] = length;
      totalLength += length;
    }
    if (totalLength <= 0) {
      return { position: spine[0]!, segmentIndex: 0, pointIndex: 0 };
    }
    let distance = clampedT * totalLength;
    for (let i = 0; i < lengths.length; i += 1) {
      const segmentLength = lengths[i] ?? 0;
      if (distance <= segmentLength || i === lengths.length - 1) {
        const a = spine[i]!;
        const b = spine[i + 1]!;
        const segmentT = segmentLength > 0 ? distance / segmentLength : 0;
        return {
          position: {
            x: a.x + (b.x - a.x) * segmentT,
            y: a.y + (b.y - a.y) * segmentT,
          },
          segmentIndex: i,
          pointIndex: i + segmentT,
        };
      }
      distance -= segmentLength;
    }
    return {
      position: spine[spine.length - 1]!,
      segmentIndex: spine.length - 2,
      pointIndex: spine.length - 1,
    };
  };

  const inputs: number[] = [];
  const ids: string[] = [];
  anchors.forEach((anchor) => {
    if (anchor.mode !== "spine") {
      return;
    }
    let position: SceneVector2 | null = null;
    let segmentIndex = 0;
    let pointIndex = 0;
    if (typeof anchor.index === "number") {
      const clampedIndex = Math.max(0, Math.min(spine.length - 1, anchor.index));
      position = spine[clampedIndex] ?? null;
      segmentIndex = Math.max(0, clampedIndex - 1);
      pointIndex = clampedIndex;
    } else if (typeof anchor.t === "number") {
      const resolved = resolvePointByT(anchor.t);
      position = resolved.position;
      segmentIndex = resolved.segmentIndex;
      pointIndex = resolved.pointIndex;
    }
    if (!position) {
      return;
    }
    const axisIdx = Math.max(0, Math.min(axisX.length - 1, segmentIndex));
    const ax = axisX[axisIdx] ?? 0;
    const ay = axisY[axisIdx] ?? 0;
    const falloffIndex = Math.max(0, Math.min(falloffFactors.length - 1, Math.floor(pointIndex)));
    const falloff = falloffFactors[falloffIndex] ?? 0;
    inputs.push(position.x, position.y, ax, ay, falloff, pointIndex);
    ids.push(anchor.id);
  });

  if (ids.length === 0) {
    return null;
  }
  return { data: new Float32Array(inputs), ids };
};

const buildPolygonCenter = (vertices: SceneVector2[]): SceneVector2 => {
  const center = vertices.reduce(
    (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
    { x: 0, y: 0 }
  );
  const invCount = vertices.length > 0 ? 1 / vertices.length : 0;
  return { x: center.x * invCount, y: center.y * invCount };
};

export const createPolygonAnchorGpuPrimitive = (options: {
  instance: SceneObjectInstance;
  groupId: string | undefined;
  anchors: RendererLayerAnchorConfig[];
  vertices: SceneVector2[];
  anim: RendererLayerAnimationConfig;
  offset: SceneVector2 | undefined;
  phaseStep?: number;
  enableMovementAxis?: boolean;
}): DynamicPrimitive | null => {
  const input = buildPolygonAnchorInputs(options.anchors, options.vertices);
  if (!input) {
    return null;
  }
  const record = registerGpuAnchors({
    instanceId: options.instance.id,
    groupId: options.groupId,
    anchors: input.ids.map((id) => ({ id, mode: "vertex" })),
  });
  if (!record) {
    return null;
  }
  const baseIndex = record.baseIndex;
  const anchorCount = input.ids.length;
  const center = buildPolygonCenter(options.vertices);

  let gl = getAnimationGpuContext();
  let resources: AnchorGpuResources | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let inputBuffer: WebGLBuffer | null = null;

  const ensureBuffers = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }
    resources = ensureResources(gl);
    if (!resources) {
      return false;
    }
    ensureAnchorCapacity(gl, resources, baseIndex + anchorCount);
    if (!inputBuffer) {
      inputBuffer = gl.createBuffer();
      if (!inputBuffer) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, input.data, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    if (!vao) {
      vao = gl.createVertexArray();
      if (!vao) {
        return false;
      }
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
      const stride = 3 * Float32Array.BYTES_PER_ELEMENT;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
      gl.bindVertexArray(null);
    }
    return true;
  };

  return {
    get data() {
      return new Float32Array(0);
    },
    autoAnimate: true,
    update(target: SceneObjectInstance): Float32Array | null {
      if (!ensureBuffers() || !gl || !resources || !vao || !inputBuffer) {
        return null;
      }
      const anim = options.anim;
      const axis = anim.axis ?? "normal";
      const useMovementAxis = Boolean(options.enableMovementAxis) && (axis === "movement-tangent" || axis === "movement-normal");
      const axisType = useMovementAxis ? 2 : axis === "tangent" ? 1 : 0;
      const movementPerp = axis === "movement-normal" ? { x: -1, y: 0 } : { x: 0, y: 1 };
      const amplitudePercent =
        typeof anim.amplitudePercentage === "number" && Number.isFinite(anim.amplitudePercentage)
          ? anim.amplitudePercentage
          : -1;
      const offset = options.offset ?? { x: 0, y: 0 };
      const origin = offset;

      gl.useProgram(resources.polygon.program);
      gl.uniform1f(resources.polygon.uniforms.timeMs, getSceneTimelineNow());
      gl.uniform1f(resources.polygon.uniforms.periodMs, Math.max(anim.periodMs ?? 1500, 1));
      gl.uniform1f(resources.polygon.uniforms.phase, anim.phase ?? 0);
      gl.uniform1f(resources.polygon.uniforms.amplitude, anim.amplitude ?? 6);
      gl.uniform1f(resources.polygon.uniforms.amplitudePercent, amplitudePercent);
      gl.uniform1f(resources.polygon.uniforms.phaseStep, options.phaseStep ?? 0.3);
      gl.uniform1i(resources.polygon.uniforms.animType, anim.type === "pulse" ? 1 : 0);
      gl.uniform1i(resources.polygon.uniforms.axisType, axisType);
      gl.uniform1i(resources.polygon.uniforms.useVertexPhase, anim.type === "sway" && !useMovementAxis ? 1 : 0);
      gl.uniform2f(resources.polygon.uniforms.center, center.x, center.y);
      gl.uniform2f(resources.polygon.uniforms.movementPerp, movementPerp.x, movementPerp.y);
      gl.uniform2f(resources.polygon.uniforms.offset, origin.x, origin.y);

      const bytesPerAnchor = 2 * Float32Array.BYTES_PER_ELEMENT;
      const rangeOffset = baseIndex * bytesPerAnchor;
      const rangeSize = anchorCount * bytesPerAnchor;

      gl.bindVertexArray(vao);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, resources.polygon.transformFeedback);
      gl.bindBufferRange(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        0,
        resources.anchorBuffer,
        rangeOffset,
        rangeSize
      );
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, anchorCount);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      return null;
    },
    dispose() {
      if (gl && inputBuffer) {
        gl.deleteBuffer(inputBuffer);
      }
      if (gl && vao) {
        gl.deleteVertexArray(vao);
      }
      releaseGpuAnchors(options.instance.id, options.groupId);
    },
  };
};

export const createSpineAnchorGpuPrimitive = (options: {
  instance: SceneObjectInstance;
  groupId: string | undefined;
  anchors: RendererLayerAnchorConfig[];
  spine: Array<{ x: number; y: number; width: number }>;
  anim: RendererLayerAnimationConfig;
  offset: SceneVector2 | undefined;
}): DynamicPrimitive | null => {
  const input = buildSpineAnchors(options.anchors, options.spine, options.anim);
  if (!input) {
    return null;
  }
  const record = registerGpuAnchors({
    instanceId: options.instance.id,
    groupId: options.groupId,
    anchors: input.ids.map((id) => ({ id, mode: "spine" })),
  });
  if (!record) {
    return null;
  }
  const baseIndex = record.baseIndex;
  const anchorCount = input.ids.length;

  let gl = getAnimationGpuContext();
  let resources: AnchorGpuResources | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let inputBuffer: WebGLBuffer | null = null;

  const ensureBuffers = (): boolean => {
    if (!gl) {
      gl = getAnimationGpuContext();
    }
    if (!gl) {
      return false;
    }
    resources = ensureResources(gl);
    if (!resources) {
      return false;
    }
    ensureAnchorCapacity(gl, resources, baseIndex + anchorCount);
    if (!inputBuffer) {
      inputBuffer = gl.createBuffer();
      if (!inputBuffer) {
        return false;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, input.data, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    if (!vao) {
      vao = gl.createVertexArray();
      if (!vao) {
        return false;
      }
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer);
      const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 5 * Float32Array.BYTES_PER_ELEMENT);
      gl.bindVertexArray(null);
    }
    return true;
  };

  return {
    get data() {
      return new Float32Array(0);
    },
    autoAnimate: true,
    update(target: SceneObjectInstance): Float32Array | null {
      if (!ensureBuffers() || !gl || !resources || !vao || !inputBuffer) {
        return null;
      }
      const anim = options.anim;
      const offset = options.offset ?? { x: 0, y: 0 };
      const origin = offset;

      gl.useProgram(resources.spine.program);
      gl.uniform1f(resources.spine.uniforms.timeMs, getSceneTimelineNow());
      gl.uniform1f(resources.spine.uniforms.periodMs, Math.max(anim.periodMs ?? 1400, 1));
      gl.uniform1f(resources.spine.uniforms.phase, anim.phase ?? 0);
      gl.uniform1f(resources.spine.uniforms.amplitude, anim.amplitude ?? 1.0);
      gl.uniform2f(resources.spine.uniforms.offset, origin.x, origin.y);

      const bytesPerAnchor = 2 * Float32Array.BYTES_PER_ELEMENT;
      const rangeOffset = baseIndex * bytesPerAnchor;
      const rangeSize = anchorCount * bytesPerAnchor;

      gl.bindVertexArray(vao);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, resources.spine.transformFeedback);
      gl.bindBufferRange(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        0,
        resources.anchorBuffer,
        rangeOffset,
        rangeSize
      );
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, anchorCount);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.bindVertexArray(null);
      return null;
    },
    dispose() {
      if (gl && inputBuffer) {
        gl.deleteBuffer(inputBuffer);
      }
      if (gl && vao) {
        gl.deleteVertexArray(vao);
      }
      releaseGpuAnchors(options.instance.id, options.groupId);
    },
  };
};

export const getAnchorsGpuBuffer = (gl: WebGL2RenderingContext): WebGLBuffer | null => {
  return ensureResources(gl)?.anchorBuffer ?? null;
};

export const updateAnchorsGpuTexture = (
  gl: WebGL2RenderingContext
): { texture: WebGLTexture; width: number } | null => {
  const resources = ensureResources(gl);
  if (!resources) {
    if (!warnedGpuTexture.has(gl)) {
      warnedGpuTexture.add(gl);
      console.warn("[AnchorsGpu] GPU anchor texture unavailable; joined primitives will fall back to CPU.");
    }
    return null;
  }
  if (!resources.texture) {
    resources.texture = gl.createTexture();
    if (!resources.texture) {
      if (!warnedGpuTexture.has(gl)) {
        warnedGpuTexture.add(gl);
        console.warn("[AnchorsGpu] Failed to create anchor texture; joined primitives will fall back to CPU.");
      }
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  if (resources.textureSize !== resources.capacity) {
    resources.textureSize = resources.capacity;
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      resources.textureSize,
      1,
      0,
      gl.RG,
      gl.FLOAT,
      null
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, resources.anchorBuffer);
  gl.bindTexture(gl.TEXTURE_2D, resources.texture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    resources.textureSize,
    1,
    gl.RG,
    gl.FLOAT,
    0
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);

  return { texture: resources.texture, width: resources.textureSize };
};

export const disposeAnchorsGpuResources = (gl: WebGL2RenderingContext): void => {
  const resources = rendererContexts.get(gl);
  if (!resources) {
    failedContexts.delete(gl);
    return;
  }
  gl.deleteProgram(resources.polygon.program);
  gl.deleteShader(resources.polygon.vertexShader);
  gl.deleteShader(resources.polygon.fragmentShader);
  gl.deleteTransformFeedback(resources.polygon.transformFeedback);

  gl.deleteProgram(resources.spine.program);
  gl.deleteShader(resources.spine.vertexShader);
  gl.deleteShader(resources.spine.fragmentShader);
  gl.deleteTransformFeedback(resources.spine.transformFeedback);

  gl.deleteBuffer(resources.anchorBuffer);
  if (resources.texture) {
    gl.deleteTexture(resources.texture);
  }

  rendererContexts.delete(gl);
  failedContexts.delete(gl);
};
