/**
 * GPU Instanced Whirl Renderer
 * Renders animated spiral whirl effects
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import { SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { GpuBatchRenderer, type SlotHandle } from "../core/GpuBatchRenderer";
import type { ExtendedGpuBatch } from "../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_STRIP } from "../core/BaseGpuPrimitive";

// ============================================================================
// Types
// ============================================================================

export interface WhirlInstance {
  position: SceneVector2;
  radius: number;
  phase: number;
  intensity: number;
  active: boolean;
  // Візуальні параметри
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: [number, number, number]; // RGB
  colorMid: [number, number, number]; // RGB
  colorOuter: [number, number, number]; // RGB
}

interface WhirlBatch extends ExtendedGpuBatch<WhirlInstance> {
  // No additional fields needed
}

interface WhirlSharedResources {
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
    radius: number;
    phase: number;
    intensity: number;
    active: number;
    rotationSpeedMultiplier: number;
    spiralArms: number;
    spiralArms2: number;
    spiralTwist: number;
    spiralTwist2: number;
    colorInner: number;
    colorMid: number;
    colorOuter: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const WHIRL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_center;
in float a_radius;
in float a_phase;
in float a_intensity;
in float a_active;
in float a_rotationSpeedMultiplier;
in float a_spiralArms;
in float a_spiralArms2;
in float a_spiralTwist;
in float a_spiralTwist2;
in vec3 a_colorInner;
in vec3 a_colorMid;
in vec3 a_colorOuter;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time;

out vec2 v_localPosition;
out float v_radius;
out float v_phase;
out float v_intensity;
out float v_time;
out float v_rotationSpeedMultiplier;
out float v_spiralArms;
out float v_spiralArms2;
out float v_spiralTwist;
out float v_spiralTwist2;
out vec3 v_colorInner;
out vec3 v_colorMid;
out vec3 v_colorOuter;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_active < 0.5) {
    v_localPosition = vec2(0.0);
    v_radius = 0.0;
    v_phase = 0.0;
    v_intensity = 0.0;
    v_time = u_time;
    v_rotationSpeedMultiplier = 1.0;
    v_spiralArms = 6.0;
    v_spiralArms2 = 12.0;
    v_spiralTwist = 7.0;
    v_spiralTwist2 = 4.0;
    v_colorInner = vec3(0.95, 0.88, 0.72);
    v_colorMid = vec3(0.85, 0.72, 0.58);
    v_colorOuter = vec3(0.68, 0.55, 0.43);
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float radius = max(a_radius, 0.0001);
  float diameter = radius * 2.0;
  vec2 offset = a_unitPosition * diameter;
  vec2 world = a_center + offset;

  v_localPosition = offset;
  v_radius = radius;
  v_phase = a_phase;
  v_intensity = max(a_intensity, 0.0);
  v_time = u_time;
  v_rotationSpeedMultiplier = max(a_rotationSpeedMultiplier, 0.0);
  v_spiralArms = max(a_spiralArms, 1.0);
  v_spiralArms2 = max(a_spiralArms2, 1.0);
  v_spiralTwist = a_spiralTwist;
  v_spiralTwist2 = a_spiralTwist2;
  v_colorInner = max(a_colorInner, vec3(0.0));
  v_colorMid = max(a_colorMid, vec3(0.0));
  v_colorOuter = max(a_colorOuter, vec3(0.0));

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const WHIRL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPosition;
in float v_radius;
in float v_phase;
in float v_intensity;
in float v_time;
in float v_rotationSpeedMultiplier;
in float v_spiralArms;
in float v_spiralArms2;
in float v_spiralTwist;
in float v_spiralTwist2;
in vec3 v_colorInner;
in vec3 v_colorMid;
in vec3 v_colorOuter;

out vec4 fragColor;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

void main() {
  float radius = max(v_radius, 0.0001);
  vec2 normalized = v_localPosition / radius;
  float distance = length(normalized);
  if (distance > 1.2) {
    fragColor = vec4(0.0);
    return;
  }

  float falloff = smoothstep(1.2, 0.0, distance);
  float angle = atan(normalized.y, normalized.x);
  float time = v_time * 0.0025 * v_rotationSpeedMultiplier;
  
  // Spiral arms - основні спіральні лінії
  float spiralTwist = -distance * v_spiralTwist + time * 16.0 + v_phase * 0.7;
  float spiral = sin(angle * v_spiralArms + spiralTwist);
  float spiralSharp = smoothstep(0.4, 0.7, spiral);
  
  // Додаткові спіралі для деталей
  float spiralTwist2 = -distance * v_spiralTwist2 + time * 12.0 + v_phase;
  float spiral2 = cos(angle * v_spiralArms2 + spiralTwist2);
  float spiralSharp2 = smoothstep(0.3, 0.65, spiral2) * 0.4;
  
  // Радіальні смуги для глибини
  float radialBands = sin(distance * 8.0 - time * 4.0) * 0.3 + 0.7;
  
  // Комбінуємо ефекти
  float whirlPattern = mix(spiralSharp, spiralSharp2, 0.3);
  whirlPattern = mix(whirlPattern, radialBands, 0.25);
  
  // Центр вихору - яскравіший
  float centerBoost = smoothstep(0.6, 0.0, distance);
  whirlPattern = mix(whirlPattern, 1.0, centerBoost * 0.4);
  
  float alpha = clamp01((0.5 + 0.5 * whirlPattern) * falloff * max(v_intensity, 0.0));

  // Міксуємо кольори залежно від відстані та паттерну
  float distMix = clamp01(distance * 1.2);
  vec3 baseColor = mix(v_colorInner, v_colorMid, distMix * 0.6);
  baseColor = mix(baseColor, v_colorOuter, distMix);
  
  // Підсвічуємо спіральні лінії
  vec3 color = mix(baseColor, v_colorInner, spiralSharp * 0.3);

  fragColor = vec4(color, alpha);
}
`;

// Instance data: center(2), radius(1), phase(1), intensity(1), active(1),
// rotationSpeedMultiplier(1), spiralArms(1), spiralArms2(1), spiralTwist(1), spiralTwist2(1),
// colorInner(3), colorMid(3), colorOuter(3)
const INSTANCE_COMPONENTS = 20;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
const DEFAULT_BATCH_CAPACITY = 512;

// ============================================================================
// WhirlGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for animated spiral whirl effects.
 * Uses instanced rendering with a single draw call per batch.
 */
class WhirlGpuRenderer extends GpuBatchRenderer<WhirlInstance, WhirlBatch, void> {
  private sharedResourcesExtended: WhirlSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, WHIRL_VERTEX_SHADER, WHIRL_FRAGMENT_SHADER, "[WhirlGpu]");
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
      radius: gl.getAttribLocation(programResult.program, "a_radius"),
      phase: gl.getAttribLocation(programResult.program, "a_phase"),
      intensity: gl.getAttribLocation(programResult.program, "a_intensity"),
      active: gl.getAttribLocation(programResult.program, "a_active"),
      rotationSpeedMultiplier: gl.getAttribLocation(programResult.program, "a_rotationSpeedMultiplier"),
      spiralArms: gl.getAttribLocation(programResult.program, "a_spiralArms"),
      spiralArms2: gl.getAttribLocation(programResult.program, "a_spiralArms2"),
      spiralTwist: gl.getAttribLocation(programResult.program, "a_spiralTwist"),
      spiralTwist2: gl.getAttribLocation(programResult.program, "a_spiralTwist2"),
      colorInner: gl.getAttribLocation(programResult.program, "a_colorInner"),
      colorMid: gl.getAttribLocation(programResult.program, "a_colorMid"),
      colorOuter: gl.getAttribLocation(programResult.program, "a_colorOuter"),
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

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): WhirlBatch | null {
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

    // Unit quad attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    if (this.sharedResourcesExtended.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
      gl.vertexAttribPointer(
        this.sharedResourcesExtended.attributes.unitPosition,
        2,
        gl.FLOAT,
        false,
        2 * Float32Array.BYTES_PER_ELEMENT,
        0
      );
      gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);
    }

    // Instance buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    const bindAttribute = (location: number, size: number, offset: number) => {
      if (location < 0) {
        return;
      }
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, INSTANCE_STRIDE, offset);
      gl.vertexAttribDivisor(location, 1);
    };

    const attrs = this.sharedResourcesExtended.attributes;
    bindAttribute(attrs.center, 2, 0);
    bindAttribute(attrs.radius, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.phase, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.intensity, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.active, 1, 5 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.rotationSpeedMultiplier, 1, 6 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralArms, 1, 7 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralArms2, 1, 8 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralTwist, 1, 9 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.spiralTwist2, 1, 10 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorInner, 3, 11 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorMid, 3, 14 * Float32Array.BYTES_PER_ELEMENT);
    bindAttribute(attrs.colorOuter, 3, 17 * Float32Array.BYTES_PER_ELEMENT);

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
    return "default"; // Whirls don't have configs
  }

  protected writeInstanceData(batch: WhirlBatch, slotIndex: number, instance: WhirlInstance): void {
    const offset = slotIndex * INSTANCE_COMPONENTS;
    const data = batch.instanceData;

    data[offset + 0] = instance.position.x;
    data[offset + 1] = instance.position.y;
    data[offset + 2] = instance.radius;
    data[offset + 3] = instance.phase;
    data[offset + 4] = instance.intensity;
    data[offset + 5] = instance.active ? 1 : 0;
    data[offset + 6] = instance.rotationSpeedMultiplier;
    data[offset + 7] = instance.spiralArms;
    data[offset + 8] = instance.spiralArms2;
    data[offset + 9] = instance.spiralTwist;
    data[offset + 10] = instance.spiralTwist2;
    data[offset + 11] = instance.colorInner[0];
    data[offset + 12] = instance.colorInner[1];
    data[offset + 13] = instance.colorInner[2];
    data[offset + 14] = instance.colorMid[0];
    data[offset + 15] = instance.colorMid[1];
    data[offset + 16] = instance.colorMid[2];
    data[offset + 17] = instance.colorOuter[0];
    data[offset + 18] = instance.colorOuter[1];
    data[offset + 19] = instance.colorOuter[2];
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    _batch: WhirlBatch,
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
  }

  protected getInstanceFloats(): number {
    return INSTANCE_COMPONENTS;
  }

  protected getActiveFloatIndex(): number {
    return 5; // active flag
  }

  protected getVertexCount(_batch: WhirlBatch): number {
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
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const whirlGpuRenderer = new WhirlGpuRenderer();

// Re-export types
export type WhirlSlotHandle = SlotHandle;
