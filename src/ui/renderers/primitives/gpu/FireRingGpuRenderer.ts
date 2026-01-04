/**
 * GPU Instanced Fire Ring Renderer
 * Renders animated fire rings with age computed on GPU
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import { SceneColor, SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../core/GpuBatchRenderer";
import type { ExtendedGpuBatch } from "../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../core/BaseGpuPrimitive";

// ============================================================================
// Types
// ============================================================================

export interface FireRingInstance {
  center: SceneVector2;
  innerRadius: number;
  outerRadius: number;
  birthTimeMs: number; // time of spawn in ms
  lifetime: number;    // ms (<=0 => infinite)
  intensity: number;
  color: SceneColor;
  active: boolean;
}

interface FireRingBatch extends ExtendedGpuBatch<FireRingInstance> {
  // No additional fields needed
}

interface FireRingSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  attributes: {
    unitPosition: number;
    center: number;
    innerRadius: number;
    outerRadius: number;
    birthTimeMs: number;
    lifetime: number;
    intensity: number;
    color: number;
    active: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const FIRE_RING_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2  a_unitPosition;   // quad [-1,-1]..[1,1]
in vec2  a_center;
in float a_innerRadius;
in float a_outerRadius;
in float a_birthTimeMs;    // <-- NEW: time of spawn in ms
in float a_lifetime;       // ms (<=0 => infinite)
in float a_intensity;
in vec3  a_color;
in float a_active;

uniform vec2  u_cameraPosition;
uniform vec2  u_viewportSize;
uniform float u_time;      // ms

out vec2  v_localPosition;
out float v_innerRadius;
out float v_outerRadius;
out float v_birthTimeMs;
out float v_lifetime;
out float v_intensity;
out vec3  v_color;
out float v_time;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_active < 0.5) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float maxRadius = a_outerRadius + 130.0; // extra space for tongues
  vec2 offset   = a_unitPosition * maxRadius;
  vec2 worldPos = a_center + offset;

  v_localPosition = offset;
  v_innerRadius   = a_innerRadius;
  v_outerRadius   = a_outerRadius;
  v_birthTimeMs   = a_birthTimeMs;
  v_lifetime      = a_lifetime;
  v_intensity     = a_intensity;
  v_color         = a_color;
  v_time          = u_time;

  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
}
`;

const FIRE_RING_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2  v_localPosition;
in float v_innerRadius;
in float v_outerRadius;
in float v_birthTimeMs;
in float v_lifetime;
in float v_intensity;
in vec3  v_color;
in float v_time;

out vec4 fragColor;

// --------- noise utils ----------
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return v;
}

// --------- tunables ----------
const float INNER_SOFT   = 6.0;
const float OUTER_SOFT   = 6.0;
const float TONGUE_BASE  = 60.0;
const float TONGUE_NOISE = 50.0;
const float UPFLOW       = 0.6;   // upward drift
const float TWIST        = 0.25;  // tiny swirl

// --------- palette ----------
vec3 fireCore()  { return vec3(1.00, 0.95, 0.70); }
vec3 fireHot()   { return vec3(1.00, 0.70, 0.20); }
vec3 fireWarm()  { return vec3(0.95, 0.45, 0.12); }
vec3 fireCool()  { return vec3(0.70, 0.18, 0.06); }

void main() {
  float dist  = length(v_localPosition);
  float timeS = v_time * 0.001;

  // Age on GPU (ms)
  float age = max(v_time - v_birthTimeMs, 0.0);

  // Expiration check (optional early kill)
  if (v_lifetime > 0.0 && age > v_lifetime + 500.0) { // grace 0.5s to avoid popping
    discard;
  }

  if (dist > v_outerRadius + 140.0) discard;

  // 1) soft ring = difference of circles
  float innerStep = 1.0 - smoothstep(v_innerRadius - INNER_SOFT, v_innerRadius + INNER_SOFT, dist);
  float outerStep =      smoothstep(v_outerRadius - OUTER_SOFT, v_outerRadius + OUTER_SOFT, dist);
  float ringMask  = clamp(innerStep * outerStep, 0.0, 1.0);

  // 2) domain warp (no angular spokes)
  vec2 uv = v_localPosition * 0.04;

  vec2 warpA = vec2(
    fbm(uv + vec2( 0.50 * timeS,  0.30 * timeS)),
    fbm(uv + vec2(-0.35 * timeS,  0.55 * timeS))
  );
  vec2 warpB = vec2(
    fbm(uv * 1.8 + vec2( 0.15 * timeS, -0.45 * timeS)),
    fbm(uv * 1.6 + vec2(-0.60 * timeS,  0.20 * timeS))
  );

  vec2 flowDir = normalize(v_localPosition + vec2(1e-6)) * TWIST;
  vec2 warped = uv
              + (warpA - 0.5) * 1.20
              + (warpB - 0.5) * 0.65
              + vec2(0.0, -UPFLOW * timeS)
              + flowDir;

  float turb = fbm(warped);

  // 3) tongues above outer radius
  float above = max(dist - v_outerRadius, 0.0);
  float flameH = TONGUE_BASE + TONGUE_NOISE * turb;
  float tongues = 1.0 - smoothstep(0.0, max(flameH, 1.0), above);
  float edge = 0.80 + 0.20 * fbm(warped * 2.3 + vec2(-0.2 * timeS, 0.35 * timeS));
  tongues *= edge;

  float flameMask = clamp(ringMask + tongues, 0.0, 1.0);
  if (flameMask < 0.01) discard;

  // 4) color
  float ringProgress = clamp((dist - v_innerRadius) / max(v_outerRadius - v_innerRadius, 1.0), 0.0, 1.0);
  vec3 base = mix(fireCore(), fireHot(), ringProgress);
  base = mix(base, fireWarm(), smoothstep(0.4, 1.0, ringProgress));
  if (above > 0.0) {
    float tip = clamp(above / max(flameH, 1.0), 0.0, 1.0);
    base = mix(base, fireCool(), tip);
  }
  vec3 color = mix(base * 0.92, base * 1.08, turb);

  vec3 tint = clamp(v_color, 0.0, 4.0);
  float luminance = max(0.0001, dot(color, vec3(0.299, 0.587, 0.114)));
  vec3 tintDir = normalize(tint + vec3(1e-6));
  vec3 tintTarget = tintDir * luminance * 1.35;
  color = mix(color, tintTarget, 0.65);
  color = mix(color, tint, 0.25);

  // 5) alpha: flicker + GPU life fade (safe)
  float flicker = 0.86 + 0.14 * fbm(warped * 1.6 + vec2(0.5 * timeS, 0.9 * timeS));

  float lifeFade = 1.0;
  if (v_lifetime > 0.0) {
    float fin  = min(v_lifetime * 0.10, 200.0);
    float fout = min(v_lifetime * 0.20, 300.0);

    float fadeIn  = (fin  > 0.0) ? smoothstep(0.0, fin, age) : 1.0;
    float outStart = max(0.0, v_lifetime - fout);
    float fadeOut = (fout > 0.0) ? (1.0 - smoothstep(outStart, v_lifetime, age)) : 1.0;

    lifeFade = clamp(min(fadeIn, fadeOut), 0.0, 1.0);
  }

  float alpha = flameMask * v_intensity * flicker * lifeFade;

  fragColor = vec4(color, alpha);
}
`;

// center(2) + inner(1) + outer(1) + birth(1) + lifetime(1) + intensity(1) + active(1) + color(3)
const INSTANCE_COMPONENTS = 11;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_BATCH_CAPACITY = 512;

// ============================================================================
// FireRingGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated fire rings.
 * Uses instanced rendering with age computed on GPU.
 */
class FireRingGpuRenderer extends GpuBatchRenderer<FireRingInstance, FireRingBatch, void> {
  private sharedResourcesExtended: FireRingSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, FIRE_RING_VERTEX_SHADER, FIRE_RING_FRAGMENT_SHADER, "[FireRingGpu]");
    if (!programResult) {
      return null;
    }

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      gl.deleteProgram(programResult.program);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_STRIP, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const attributes = {
      unitPosition: gl.getAttribLocation(programResult.program, "a_unitPosition"),
      center: gl.getAttribLocation(programResult.program, "a_center"),
      innerRadius: gl.getAttribLocation(programResult.program, "a_innerRadius"),
      outerRadius: gl.getAttribLocation(programResult.program, "a_outerRadius"),
      birthTimeMs: gl.getAttribLocation(programResult.program, "a_birthTimeMs"),
      lifetime: gl.getAttribLocation(programResult.program, "a_lifetime"),
      intensity: gl.getAttribLocation(programResult.program, "a_intensity"),
      color: gl.getAttribLocation(programResult.program, "a_color"),
      active: gl.getAttribLocation(programResult.program, "a_active"),
    };

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      time: gl.getUniformLocation(programResult.program, "u_time"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      quadBuffer,
      uniforms,
      attributes,
    };

    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): FireRingBatch | null {
    if (!this.sharedResourcesExtended) {
      return null;
    }

    const instanceBuffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    if (!instanceBuffer || !vao) {
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      if (vao) gl.deleteVertexArray(vao);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    gl.bindVertexArray(vao);

    // Quad attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    if (this.sharedResourcesExtended.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
      gl.vertexAttribPointer(
        this.sharedResourcesExtended.attributes.unitPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);
    }

    // Instance attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const attrs = this.sharedResourcesExtended.attributes;
    let offset = 0;

    if (attrs.center >= 0) {
      gl.enableVertexAttribArray(attrs.center);
      gl.vertexAttribPointer(attrs.center, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.center, 1);
      offset += 2 * Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.innerRadius >= 0) {
      gl.enableVertexAttribArray(attrs.innerRadius);
      gl.vertexAttribPointer(attrs.innerRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.innerRadius, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.outerRadius >= 0) {
      gl.enableVertexAttribArray(attrs.outerRadius);
      gl.vertexAttribPointer(attrs.outerRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.outerRadius, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.birthTimeMs >= 0) {
      gl.enableVertexAttribArray(attrs.birthTimeMs);
      gl.vertexAttribPointer(attrs.birthTimeMs, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.birthTimeMs, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.lifetime >= 0) {
      gl.enableVertexAttribArray(attrs.lifetime);
      gl.vertexAttribPointer(attrs.lifetime, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.lifetime, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.intensity >= 0) {
      gl.enableVertexAttribArray(attrs.intensity);
      gl.vertexAttribPointer(attrs.intensity, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.intensity, 1);
      offset += Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.color >= 0) {
      gl.enableVertexAttribArray(attrs.color);
      gl.vertexAttribPointer(attrs.color, 3, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.color, 1);
      offset += 3 * Float32Array.BYTES_PER_ELEMENT;
    }
    if (attrs.active >= 0) {
      gl.enableVertexAttribArray(attrs.active);
      gl.vertexAttribPointer(attrs.active, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(attrs.active, 1);
    }

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const freeSlots: number[] = [];
    for (let i = capacity - 1; i >= 0; i--) {
      freeSlots.push(i);
    }

    return {
      gl,
      capacity,
      instanceBuffer,
      vao,
      freeSlots,
      activeCount: 0,
      instances: new Array(capacity).fill(null),
      needsUpload: false,
      instanceData: new Float32Array(capacity * INSTANCE_COMPONENTS),
    };
  }

  protected getBatchKey(_config: void): string {
    return "default"; // FireRings don't have configs
  }

  protected writeInstanceData(batch: FireRingBatch, slotIndex: number, instance: FireRingInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.center.x;
    data[offset + 1] = instance.center.y;
    data[offset + 2] = instance.innerRadius;
    data[offset + 3] = instance.outerRadius;
    data[offset + 4] = instance.birthTimeMs;
    data[offset + 5] = instance.lifetime;
    data[offset + 6] = instance.intensity;
    data[offset + 7] = instance.color.r ?? 1.0;
    data[offset + 8] = instance.color.g ?? 1.0;
    data[offset + 9] = instance.color.b ?? 1.0;
    data[offset + 10] = instance.active ? 1 : 0;
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: FireRingBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const { uniforms } = this.sharedResourcesExtended;

    if (uniforms.cameraPosition) {
      gl.uniform2f(uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
    }
    if (uniforms.viewportSize) {
      gl.uniform2f(uniforms.viewportSize, viewportSize.width, viewportSize.height);
    }
    if (uniforms.time) {
      gl.uniform1f(uniforms.time, timestampMs);
    }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); // soft additive
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 10; // active flag
  }

  protected getVertexCount(_batch: FireRingBatch): number {
    return 4; // TRIANGLE_STRIP quad
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLE_STRIP;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.sharedResourcesExtended?.quadBuffer) {
      gl.deleteBuffer(this.sharedResourcesExtended.quadBuffer);
    }
    this.sharedResourcesExtended = null;
  }

  /**
   * Override render to restore default blend func after rendering
   */
  public override render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    super.render(gl, cameraPosition, viewportSize, timestampMs);
    
    // Restore default blend func
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const fireRingGpuRenderer = new FireRingGpuRenderer();

// Re-export types
export type FireRingSlotHandle = SlotHandle;

// ============================================================================
// Helper functions for backward compatibility
// ============================================================================

/**
 * Add a fire ring instance (acquires slot automatically)
 */
export const addFireRingInstance = (
  gl: WebGL2RenderingContext,
  instance: FireRingInstance
): void => {
  // Set context if not already set
  if (fireRingGpuRenderer["gl"] !== gl) {
    fireRingGpuRenderer.setContext(gl);
  }

  // Acquire slot and update
  const handle = fireRingGpuRenderer.acquireSlot(undefined);
  if (handle) {
    fireRingGpuRenderer.updateSlot(handle, instance);
  }
};

/**
 * Update fire ring instance (marks as inactive if lifetime expired)
 */
export const updateFireRing = (
  _gl: WebGL2RenderingContext,
  instance: FireRingInstance,
  nowMs: number
): void => {
  if (!instance.active) return;
  if (instance.lifetime > 0) {
    const age = nowMs - instance.birthTimeMs;
    if (age >= instance.lifetime) {
      instance.active = false;
    }
  }
};

/**
 * Render fire rings
 */
export const renderFireRings = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number },
  timeMs: number
): void => {
  fireRingGpuRenderer.beforeRender(gl, timeMs);
  fireRingGpuRenderer.render(gl, cameraPosition, viewportSize, timeMs);
};

/**
 * Dispose fire ring resources
 */
export const disposeFireRing = (gl: WebGL2RenderingContext): void => {
  fireRingGpuRenderer.setContext(null);
};
