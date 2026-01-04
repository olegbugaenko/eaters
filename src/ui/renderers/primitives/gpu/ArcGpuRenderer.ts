/**
 * GPU Instanced Arc Renderer
 * Renders animated arcs with configurable uniforms per batch
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../core/GpuBatchRenderer";
import type { ExtendedGpuBatch } from "../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../core/BaseGpuPrimitive";

// ============================================================================
// Types
// ============================================================================

export interface ArcInstance {
  from: SceneVector2;
  to: SceneVector2;
  age: number;
  lifetime: number;
  active: boolean;
}

export type ArcGpuUniforms = {
  coreColor: Float32Array; // vec4
  blurColor: Float32Array; // vec4
  coreWidth: number;
  blurWidth: number;
  fadeStartMs: number;
  noiseAmplitude: number;
  noiseDensity: number; // cycles per length unit
  oscAmplitude: number;
  oscAngularSpeed: number; // radians per ms
};

export interface ArcBatchConfig {
  batchKey: string;
  uniforms: ArcGpuUniforms;
}

interface ArcBatch extends ExtendedGpuBatch<ArcInstance> {
  uniforms: ArcGpuUniforms;
}

interface ArcSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    coreColor: WebGLUniformLocation | null;
    blurColor: WebGLUniformLocation | null;
    coreWidth: WebGLUniformLocation | null;
    blurWidth: WebGLUniformLocation | null;
    fadeStartMs: WebGLUniformLocation | null;
    noiseAmplitude: WebGLUniformLocation | null;
    noiseDensity: WebGLUniformLocation | null;
    oscAmplitude: WebGLUniformLocation | null;
    oscAngularSpeed: WebGLUniformLocation | null;
  };
  attributes: {
    unitPos: number;
    from: number;
    to: number;
    age: number;
    lifetime: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPos; // quad: [-0.5..0.5]x[-0.5..0.5]
in vec2 a_from;
in vec2 a_to;
in float a_age;
in float a_lifetime;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_noiseAmplitude;
uniform float u_noiseDensity;
uniform float u_oscAmplitude;

out vec2 v_worldPos;
flat out vec2 v_from;
flat out float v_age;
flat out float v_lifetime;
flat out vec2 v_axis;
flat out vec2 v_normal;
flat out float v_length;
flat out float v_noisePhaseScale;
flat out float v_shortScale;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  v_from = a_from;
  v_age = a_age;
  v_lifetime = a_lifetime;
  float noiseReach = u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float halfWidth = 0.5 * u_coreWidth + u_blurWidth + noiseReach;

  // Build a bounding quad around the segment
  vec2 dir = a_to - a_from;
  float len = max(length(dir), 0.0001);
  vec2 axis = dir / len;
  vec2 normal = vec2(-axis.y, axis.x);
  float nominal = max(u_coreWidth + 2.0 * u_blurWidth, 0.0001);
  v_axis = axis;
  v_normal = normal;
  v_length = len;
  v_noisePhaseScale = len * u_noiseDensity * 3.14159265359; // 0.5 * TAU
  v_shortScale = clamp(len / nominal, 0.35, 1.0);

  // a_unitPos.x in [-0.5,0.5] maps along axis from center; a_unitPos.y scales normal
  vec2 center = (a_from + a_to) * 0.5;
  float along = a_unitPos.x * len;
  float side = a_unitPos.y * halfWidth * 2.0; // full height quad
  vec2 world = center + axis * along + normal * side;

  v_worldPos = world;
  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_worldPos;
flat in vec2 v_from;
flat in float v_age;
flat in float v_lifetime;
flat in vec2 v_axis;
flat in vec2 v_normal;
flat in float v_length;
flat in float v_noisePhaseScale;
flat in float v_shortScale;

uniform vec4 u_coreColor;
uniform vec4 u_blurColor;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_fadeStartMs;
uniform float u_noiseAmplitude;
uniform float u_oscAmplitude;
uniform float u_oscAngularSpeed;

out vec4 fragColor;

float clamp01(float v){return clamp(v,0.0,1.0);} 

// Optimized noise function - reduced complexity but keeps visual quality
float noise1(float t){
  return sin(t) * 0.7 + sin(t*1.7+1.3)*0.3;
}

void main(){
  float len = max(v_length, 0.0001);
  vec2 rel = v_worldPos - v_from;
  float proj = dot(rel, v_axis);
  float t = clamp(proj / len, 0.0, 1.0);
  float baseOffset = dot(rel, v_normal);

  float phase = t * v_noisePhaseScale;
  float timeOsc = u_oscAngularSpeed * v_age;
  float n = noise1(phase + timeOsc) * u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float dist = abs(baseOffset - n);

  float taperFrac = 0.2;
  float endIn  = smoothstep(0.0, taperFrac, t);
  float endOut = smoothstep(0.0, taperFrac, 1.0 - t);
  float endTaper = endIn * endOut;

  float shortScale = v_shortScale;
  float core = (u_coreWidth * 0.5) * max(0.0, endTaper) * shortScale;
  float blur = u_blurWidth * max(0.0, endTaper) * shortScale;
  float safeBlur = max(blur, 0.0001);

  float blend = clamp01((dist - core) / safeBlur);
  float inside = 1.0 - step(core, dist);
  float coreBlend = mix(1.0 - blend, 1.0, inside);

  float fade = 1.0;
  if (u_fadeStartMs < v_lifetime) {
    if (v_age > u_fadeStartMs) {
      float fdur = max(1.0, v_lifetime - u_fadeStartMs);
      float fprog = clamp01((v_age - u_fadeStartMs) / fdur);
      fade = 1.0 - fprog;
    }
  }

  vec3 rgb = mix(u_blurColor.rgb, u_coreColor.rgb, coreBlend);
  float a = mix(u_blurColor.a, u_coreColor.a, coreBlend);
  float finalAlpha = a * coreBlend * fade;

  fragColor = vec4(rgb, finalAlpha);
  if (fragColor.a <= 0.001) discard;
}
`;

// Instance data: from(2), to(2), age(1), lifetime(1)
const INSTANCE_COMPONENTS = 6;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_BATCH_CAPACITY = 512;

// ============================================================================
// ArcGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated arcs.
 * Uses instanced rendering with configurable uniforms per batch.
 */
class ArcGpuRenderer extends GpuBatchRenderer<ArcInstance, ArcBatch, ArcBatchConfig> {
  private sharedResourcesExtended: ArcSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER, "[ArcGpu]");
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

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      coreColor: gl.getUniformLocation(programResult.program, "u_coreColor"),
      blurColor: gl.getUniformLocation(programResult.program, "u_blurColor"),
      coreWidth: gl.getUniformLocation(programResult.program, "u_coreWidth"),
      blurWidth: gl.getUniformLocation(programResult.program, "u_blurWidth"),
      fadeStartMs: gl.getUniformLocation(programResult.program, "u_fadeStartMs"),
      noiseAmplitude: gl.getUniformLocation(programResult.program, "u_noiseAmplitude"),
      noiseDensity: gl.getUniformLocation(programResult.program, "u_noiseDensity"),
      oscAmplitude: gl.getUniformLocation(programResult.program, "u_oscAmplitude"),
      oscAngularSpeed: gl.getUniformLocation(programResult.program, "u_oscAngularSpeed"),
    };

    const attributes = {
      unitPos: gl.getAttribLocation(programResult.program, "a_unitPos"),
      from: gl.getAttribLocation(programResult.program, "a_from"),
      to: gl.getAttribLocation(programResult.program, "a_to"),
      age: gl.getAttribLocation(programResult.program, "a_age"),
      lifetime: gl.getAttribLocation(programResult.program, "a_lifetime"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      quadBuffer,
      uniforms,
      attributes,
    };

    return { program: programResult.program };
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): ArcBatch | null {
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

    gl.bindVertexArray(vao);

    // unit quad attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPos);
    gl.vertexAttribPointer(
      this.sharedResourcesExtended.attributes.unitPos,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPos, 0);

    // instance buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const enable = (loc: number, size: number, offsetFloats: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, INSTANCE_STRIDE, offsetFloats * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribDivisor(loc, 1);
    };

    enable(this.sharedResourcesExtended.attributes.from, 2, 0);
    enable(this.sharedResourcesExtended.attributes.to, 2, 2);
    enable(this.sharedResourcesExtended.attributes.age, 1, 4);
    enable(this.sharedResourcesExtended.attributes.lifetime, 1, 5);

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
      uniforms: {
        coreColor: new Float32Array([0, 0, 0, 1]),
        blurColor: new Float32Array([0, 0, 0, 1]),
        coreWidth: 0,
        blurWidth: 0,
        fadeStartMs: 0,
        noiseAmplitude: 0,
        noiseDensity: 0,
        oscAmplitude: 0,
        oscAngularSpeed: 0,
      },
    };
  }

  protected getBatchKey(config: ArcBatchConfig): string {
    return config.batchKey;
  }

  protected writeInstanceData(batch: ArcBatch, slotIndex: number, instance: ArcInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.from.x;
    data[offset + 1] = instance.from.y;
    data[offset + 2] = instance.to.x;
    data[offset + 3] = instance.to.y;
    data[offset + 4] = Math.max(0, instance.age);
    data[offset + 5] = Math.max(0, instance.lifetime);
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    batch: ArcBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const { uniforms: sharedUniforms } = this.sharedResourcesExtended;
    const { uniforms: batchUniforms } = batch;

    // Camera uniforms (shared across batches)
    if (sharedUniforms.cameraPosition) {
      gl.uniform2f(sharedUniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
    }
    if (sharedUniforms.viewportSize) {
      gl.uniform2f(sharedUniforms.viewportSize, viewportSize.width, viewportSize.height);
    }

    // Batch-specific uniforms
    if (sharedUniforms.coreColor) gl.uniform4fv(sharedUniforms.coreColor, batchUniforms.coreColor);
    if (sharedUniforms.blurColor) gl.uniform4fv(sharedUniforms.blurColor, batchUniforms.blurColor);
    if (sharedUniforms.coreWidth) gl.uniform1f(sharedUniforms.coreWidth, batchUniforms.coreWidth);
    if (sharedUniforms.blurWidth) gl.uniform1f(sharedUniforms.blurWidth, batchUniforms.blurWidth);
    if (sharedUniforms.fadeStartMs) gl.uniform1f(sharedUniforms.fadeStartMs, batchUniforms.fadeStartMs);
    if (sharedUniforms.noiseAmplitude) gl.uniform1f(sharedUniforms.noiseAmplitude, batchUniforms.noiseAmplitude);
    if (sharedUniforms.noiseDensity) gl.uniform1f(sharedUniforms.noiseDensity, batchUniforms.noiseDensity);
    if (sharedUniforms.oscAmplitude) gl.uniform1f(sharedUniforms.oscAmplitude, batchUniforms.oscAmplitude);
    if (sharedUniforms.oscAngularSpeed) gl.uniform1f(sharedUniforms.oscAngularSpeed, batchUniforms.oscAngularSpeed);
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    // Arc doesn't have explicit active flag in data, but we track it in instances array
    // Return last index as placeholder
    return INSTANCE_COMPONENTS - 1;
  }

  protected getVertexCount(_batch: ArcBatch): number {
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
   * Override acquireSlot to set batch uniforms from config.
   */
  public override acquireSlot(config: ArcBatchConfig): SlotHandle | null {
    const handle = super.acquireSlot(config);
    if (!handle) {
      return null;
    }

    const batch = this.batches.get(handle.batchKey);
    if (batch) {
      // Copy uniforms from config to batch
      batch.uniforms = {
        coreColor: new Float32Array(config.uniforms.coreColor),
        blurColor: new Float32Array(config.uniforms.blurColor),
        coreWidth: config.uniforms.coreWidth,
        blurWidth: config.uniforms.blurWidth,
        fadeStartMs: config.uniforms.fadeStartMs,
        noiseAmplitude: config.uniforms.noiseAmplitude,
        noiseDensity: config.uniforms.noiseDensity,
        oscAmplitude: config.uniforms.oscAmplitude,
        oscAngularSpeed: config.uniforms.oscAngularSpeed,
      };
    }

    return handle;
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const arcGpuRenderer = new ArcGpuRenderer();

// Re-export types for backward compatibility
export type ArcSlotHandle = SlotHandle;

