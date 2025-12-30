/**
 * GPU Instanced Renderer for Bullets
 * 
 * Renders all bullets of the same visual type in a single draw call.
 * Supports different bullet types with different appearances.
 * Uses object pooling - slots are reused, buffer is never rebuilt.
 */

import type { SceneColor, SceneVector2, SceneSize } from "../../../../logic/services/SceneObjectManager";

// ============================================================================
// Types
// ============================================================================

export interface BulletVisualConfig {
  /** Unique key identifying this visual type (e.g., "default", "ice", "fire") */
  readonly visualKey: string;
  /** Base color for the bullet body */
  readonly bodyColor: SceneColor;
  /** Color at the start of the tail (near bullet) */
  readonly tailStartColor: SceneColor;
  /** Color at the end of the tail (fading out) */
  readonly tailEndColor: SceneColor;
  /** Tail length multiplier relative to bullet radius */
  readonly tailLengthMultiplier: number;
  /** Tail width multiplier relative to bullet radius */
  readonly tailWidthMultiplier: number;
  /** Shape: "circle" or "triangle" */
  readonly shape: "circle" | "triangle";
}

export interface BulletInstance {
  position: SceneVector2;
  rotation: number;
  radius: number;
  active: boolean;
}

interface BulletBatch {
  readonly gl: WebGL2RenderingContext;
  readonly visualKey: string;
  readonly config: BulletVisualConfig;
  readonly vao: WebGLVertexArrayObject;
  readonly instanceBuffer: WebGLBuffer;
  readonly capacity: number;
  instances: (BulletInstance | null)[];
  freeSlots: number[];
  activeCount: number;
  needsUpload: boolean;
  instanceData: Float32Array;
}

interface BulletGpuResources {
  readonly program: WebGLProgram;
  readonly quadBuffer: WebGLBuffer;
  readonly uniforms: {
    readonly cameraPosition: WebGLUniformLocation | null;
    readonly viewportSize: WebGLUniformLocation | null;
    readonly bodyColor: WebGLUniformLocation | null;
    readonly tailStartColor: WebGLUniformLocation | null;
    readonly tailEndColor: WebGLUniformLocation | null;
    readonly tailLengthMul: WebGLUniformLocation | null;
    readonly tailWidthMul: WebGLUniformLocation | null;
    readonly shapeType: WebGLUniformLocation | null;
  };
  readonly attributes: {
    readonly unitPosition: number;
    readonly instancePosition: number;
    readonly instanceRotation: number;
    readonly instanceRadius: number;
    readonly instanceActive: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BATCH_CAPACITY = 256;

// Instance data layout: posX, posY, rotation, radius, active
const INSTANCE_FLOATS = 5;
const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

// Unit quad for instanced rendering
const UNIT_QUAD = new Float32Array([
  -1, -1,
   1, -1,
   1,  1,
  -1, -1,
   1,  1,
  -1,  1,
]);

// ============================================================================
// Shaders
// ============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (unit quad)
in vec2 a_unitPosition;

// Per-instance
in vec2 a_instancePosition;
in float a_instanceRotation;
in float a_instanceRadius;
in float a_instanceActive;

// Uniforms
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_tailLengthMul;
uniform float u_tailWidthMul;
uniform int u_shapeType; // 0 = circle, 1 = triangle

// Outputs
out vec2 v_localPos;
out float v_radius;
out float v_tailLength;
out float v_tailWidth;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_instanceActive < 0.5) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }
  
  float tailLength = a_instanceRadius * u_tailLengthMul;
  float tailWidth = a_instanceRadius * u_tailWidthMul;
  
  // Scale local position to cover bullet + tail
  float scaleX = a_instanceRadius + tailLength;
  float scaleY = max(a_instanceRadius, tailWidth);
  
  vec2 localPos = a_unitPosition * vec2(scaleX, scaleY);
  
  // Rotate
  float c = cos(a_instanceRotation);
  float s = sin(a_instanceRotation);
  vec2 rotatedPos = vec2(
    localPos.x * c - localPos.y * s,
    localPos.x * s + localPos.y * c
  );
  
  // World position
  vec2 worldPos = a_instancePosition + rotatedPos;
  
  // To clip space (same formula as PetalAuraGpuRenderer)
  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_localPos = a_unitPosition;
  v_radius = a_instanceRadius;
  v_tailLength = tailLength;
  v_tailWidth = tailWidth;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPos;
in float v_radius;
in float v_tailLength;
in float v_tailWidth;

uniform vec4 u_bodyColor;
uniform vec4 u_tailStartColor;
uniform vec4 u_tailEndColor;
uniform int u_shapeType;

out vec4 fragColor;

void main() {
  float scaleX = v_radius + v_tailLength;
  float scaleY = max(v_radius, v_tailWidth);
  
  // Convert back to world-relative coords
  vec2 pos = v_localPos * vec2(scaleX, scaleY);
  
  // Distance from center for body
  float dist = length(pos);
  
  // Body (circle or triangle at front)
  if (u_shapeType == 0) {
    // Circle body
    if (dist < v_radius) {
      float edge = smoothstep(v_radius, v_radius - 1.0, dist);
      fragColor = vec4(u_bodyColor.rgb, u_bodyColor.a * edge);
      return;
    }
  } else {
    // Triangle body - check if in front triangle
    float triLength = v_radius * 3.0; // Longer nose
    if (pos.x > 0.0 && pos.x < triLength) {
      float triWidth = (1.0 - pos.x / triLength) * v_radius;
      if (abs(pos.y) < triWidth) {
        fragColor = u_bodyColor;
        return;
      }
    }
  }
  
  // Tail (behind the bullet, x < 0)
  if (pos.x < 0.0 && pos.x > -v_tailLength) {
    float t = -pos.x / v_tailLength; // 0 at body, 1 at tail end
    float tailWidthAtX = v_tailWidth * (1.0 - t * 0.7); // Taper
    
    if (abs(pos.y) < tailWidthAtX) {
      float edgeFade = 1.0 - abs(pos.y) / tailWidthAtX;
      vec4 tailColor = mix(u_tailStartColor, u_tailEndColor, t);
      fragColor = vec4(tailColor.rgb, tailColor.a * edgeFade);
      return;
    }
  }
  
  discard;
}
`;

// ============================================================================
// Resource Management
// ============================================================================

let globalGl: WebGL2RenderingContext | null = null;
let globalResources: BulletGpuResources | null = null;
const batches = new Map<string, BulletBatch>();

export const setBulletGpuContext = (gl: WebGL2RenderingContext | null): void => {
  if (gl === globalGl) return;
  
  // Cleanup old resources
  if (globalResources && globalGl) {
    globalGl.deleteProgram(globalResources.program);
    globalGl.deleteBuffer(globalResources.quadBuffer);
  }
  batches.forEach((batch) => disposeBatch(batch));
  batches.clear();
  
  globalGl = gl;
  globalResources = gl ? createResources(gl) : null;
};

export const getBulletGpuContext = (): WebGL2RenderingContext | null => globalGl;

const createResources = (gl: WebGL2RenderingContext): BulletGpuResources | null => {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;
  
  gl.shaderSource(vs, VERTEX_SHADER);
  gl.shaderSource(fs, FRAGMENT_SHADER);
  gl.compileShader(vs);
  gl.compileShader(fs);
  
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("[BulletGpu] Vertex shader error:", gl.getShaderInfoLog(vs));
    return null;
  }
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("[BulletGpu] Fragment shader error:", gl.getShaderInfoLog(fs));
    return null;
  }
  
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[BulletGpu] Program link error:", gl.getProgramInfoLog(program));
    return null;
  }
  
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) return null;
  
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  return {
    program,
    quadBuffer,
    uniforms: {
      cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
      bodyColor: gl.getUniformLocation(program, "u_bodyColor"),
      tailStartColor: gl.getUniformLocation(program, "u_tailStartColor"),
      tailEndColor: gl.getUniformLocation(program, "u_tailEndColor"),
      tailLengthMul: gl.getUniformLocation(program, "u_tailLengthMul"),
      tailWidthMul: gl.getUniformLocation(program, "u_tailWidthMul"),
      shapeType: gl.getUniformLocation(program, "u_shapeType"),
    },
    attributes: {
      unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
      instancePosition: gl.getAttribLocation(program, "a_instancePosition"),
      instanceRotation: gl.getAttribLocation(program, "a_instanceRotation"),
      instanceRadius: gl.getAttribLocation(program, "a_instanceRadius"),
      instanceActive: gl.getAttribLocation(program, "a_instanceActive"),
    },
  };
};

// ============================================================================
// Batch Management
// ============================================================================

const createBatch = (
  gl: WebGL2RenderingContext,
  config: BulletVisualConfig,
  capacity: number
): BulletBatch | null => {
  if (!globalResources) return null;
  
  const vao = gl.createVertexArray();
  const instanceBuffer = gl.createBuffer();
  if (!vao || !instanceBuffer) return null;
  
  const { attributes } = globalResources;
  
  gl.bindVertexArray(vao);
  
  // Unit quad (per-vertex)
  gl.bindBuffer(gl.ARRAY_BUFFER, globalResources.quadBuffer);
  gl.enableVertexAttribArray(attributes.unitPosition);
  gl.vertexAttribPointer(attributes.unitPosition, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(attributes.unitPosition, 0);
  
  // Instance buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);
  
  // Instance attributes
  let offset = 0;
  
  // position (vec2)
  gl.enableVertexAttribArray(attributes.instancePosition);
  gl.vertexAttribPointer(attributes.instancePosition, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset);
  gl.vertexAttribDivisor(attributes.instancePosition, 1);
  offset += 2 * 4;
  
  // rotation (float)
  gl.enableVertexAttribArray(attributes.instanceRotation);
  gl.vertexAttribPointer(attributes.instanceRotation, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
  gl.vertexAttribDivisor(attributes.instanceRotation, 1);
  offset += 1 * 4;
  
  // radius (float)
  gl.enableVertexAttribArray(attributes.instanceRadius);
  gl.vertexAttribPointer(attributes.instanceRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
  gl.vertexAttribDivisor(attributes.instanceRadius, 1);
  offset += 1 * 4;
  
  // active (float)
  gl.enableVertexAttribArray(attributes.instanceActive);
  gl.vertexAttribPointer(attributes.instanceActive, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
  gl.vertexAttribDivisor(attributes.instanceActive, 1);
  
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  
  // Initialize instances and free slots
  const instances: (BulletInstance | null)[] = new Array(capacity).fill(null);
  const freeSlots: number[] = [];
  for (let i = capacity - 1; i >= 0; i -= 1) {
    freeSlots.push(i);
  }
  
  return {
    gl,
    visualKey: config.visualKey,
    config,
    vao,
    instanceBuffer,
    capacity,
    instances,
    freeSlots,
    activeCount: 0,
    needsUpload: false,
    instanceData: new Float32Array(capacity * INSTANCE_FLOATS),
  };
};

const disposeBatch = (batch: BulletBatch): void => {
  batch.gl.deleteVertexArray(batch.vao);
  batch.gl.deleteBuffer(batch.instanceBuffer);
};

const ensureBatch = (config: BulletVisualConfig): BulletBatch | null => {
  if (!globalGl || !globalResources) return null;
  
  const existing = batches.get(config.visualKey);
  if (existing) return existing;
  
  const newBatch = createBatch(globalGl, config, DEFAULT_BATCH_CAPACITY);
  if (newBatch) {
    batches.set(config.visualKey, newBatch);
  }
  return newBatch;
};

// ============================================================================
// Public API
// ============================================================================

export interface BulletSlotHandle {
  readonly visualKey: string;
  readonly slotIndex: number;
}

/**
 * Acquires a slot for a new bullet.
 * Returns a handle to update/release the slot, or null if no space.
 */
export const acquireBulletSlot = (config: BulletVisualConfig): BulletSlotHandle | null => {
  const batch = ensureBatch(config);
  if (!batch || batch.freeSlots.length === 0) {
    // TODO: Could grow batch here if needed
    return null;
  }
  
  const slotIndex = batch.freeSlots.pop()!;
  batch.instances[slotIndex] = {
    position: { x: 0, y: 0 },
    rotation: 0,
    radius: 1,
    active: false,
  };
  
  return { visualKey: config.visualKey, slotIndex };
};

/**
 * Updates a bullet's position and rotation.
 */
export const updateBulletSlot = (
  handle: BulletSlotHandle,
  position: SceneVector2,
  rotation: number,
  radius: number,
  active: boolean
): void => {
  const batch = batches.get(handle.visualKey);
  if (!batch) return;
  
  const instance = batch.instances[handle.slotIndex];
  if (!instance) return;
  
  const wasActive = instance.active;
  
  instance.position.x = position.x;
  instance.position.y = position.y;
  instance.rotation = rotation;
  instance.radius = radius;
  instance.active = active;
  
  // Update instance data
  const offset = handle.slotIndex * INSTANCE_FLOATS;
  batch.instanceData[offset + 0] = position.x;
  batch.instanceData[offset + 1] = position.y;
  batch.instanceData[offset + 2] = rotation;
  batch.instanceData[offset + 3] = radius;
  batch.instanceData[offset + 4] = active ? 1 : 0;
  
  batch.needsUpload = true;
  
  // Track active count
  if (active && !wasActive) {
    batch.activeCount += 1;
  } else if (!active && wasActive) {
    batch.activeCount = Math.max(0, batch.activeCount - 1);
  }
};

/**
 * Releases a bullet slot back to the pool.
 */
export const releaseBulletSlot = (handle: BulletSlotHandle): void => {
  const batch = batches.get(handle.visualKey);
  if (!batch) return;
  
  const instance = batch.instances[handle.slotIndex];
  if (instance?.active) {
    batch.activeCount = Math.max(0, batch.activeCount - 1);
  }
  
  batch.instances[handle.slotIndex] = null;
  batch.freeSlots.push(handle.slotIndex);
  
  // Mark slot as inactive in GPU data
  const offset = handle.slotIndex * INSTANCE_FLOATS;
  batch.instanceData[offset + 4] = 0;
  batch.needsUpload = true;
};

/**
 * Gets all active bullets for interpolation snapshot sync.
 */
export const getAllActiveBullets = (): Array<{ handle: BulletSlotHandle; position: SceneVector2 }> => {
  const result: Array<{ handle: BulletSlotHandle; position: SceneVector2 }> = [];
  batches.forEach((batch, visualKey) => {
    for (let i = 0; i < batch.capacity; i++) {
      const instance = batch.instances[i];
      if (instance && instance.active) {
        result.push({
          handle: { visualKey, slotIndex: i },
          position: { x: instance.position.x, y: instance.position.y },
        });
      }
    }
  });
  return result;
};

/**
 * Applies interpolated positions to bullets before rendering.
 * Only updates positions for bullets that are still active.
 */
export const applyInterpolatedBulletPositions = (
  interpolatedPositions: Map<string, SceneVector2>
): void => {
  if (interpolatedPositions.size === 0) return;
  
  interpolatedPositions.forEach((position, key) => {
    // Parse key: "visualKey:slotIndex"
    const parts = key.split(":");
    if (parts.length !== 2) return;
    const [visualKey, slotIndexStr] = parts;
    if (!visualKey || !slotIndexStr) return;
    
    const slotIndex = parseInt(slotIndexStr, 10);
    if (isNaN(slotIndex)) return;
    
    const batch = batches.get(visualKey);
    if (!batch) return;
    
    const instance = batch.instances[slotIndex];
    // CRITICAL: Only update if bullet is still active!
    if (!instance || !instance.active) return;
    
    // Update position in instance data
    instance.position.x = position.x;
    instance.position.y = position.y;
    
    const offset = slotIndex * INSTANCE_FLOATS;
    batch.instanceData[offset + 0] = position.x;
    batch.instanceData[offset + 1] = position.y;
    batch.needsUpload = true;
  });
};

/**
 * Uploads dirty batches to GPU. Call once per frame before render.
 */
export const uploadBulletBatches = (): void => {
  batches.forEach((batch) => {
    if (!batch.needsUpload) return;
    
    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, batch.instanceBuffer);
    batch.gl.bufferSubData(batch.gl.ARRAY_BUFFER, 0, batch.instanceData);
    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, null);
    batch.needsUpload = false;
  });
};

/**
 * Renders all bullet batches.
 */
export const renderBulletBatches = (
  cameraPosition: SceneVector2,
  viewportSize: SceneSize
): void => {
  if (!globalGl || !globalResources) return;
  
  const gl = globalGl;
  const { program, uniforms } = globalResources;
  
  gl.useProgram(program);
  gl.uniform2f(uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  gl.uniform2f(uniforms.viewportSize, viewportSize.width, viewportSize.height);
  
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  
  batches.forEach((batch) => {
    if (batch.activeCount <= 0) return;
    
    const { config } = batch;
    
    // Set per-batch uniforms
    gl.uniform4f(uniforms.bodyColor, config.bodyColor.r, config.bodyColor.g, config.bodyColor.b, config.bodyColor.a ?? 1);
    gl.uniform4f(uniforms.tailStartColor, config.tailStartColor.r, config.tailStartColor.g, config.tailStartColor.b, config.tailStartColor.a ?? 1);
    gl.uniform4f(uniforms.tailEndColor, config.tailEndColor.r, config.tailEndColor.g, config.tailEndColor.b, config.tailEndColor.a ?? 0);
    gl.uniform1f(uniforms.tailLengthMul, config.tailLengthMultiplier);
    gl.uniform1f(uniforms.tailWidthMul, config.tailWidthMultiplier);
    gl.uniform1i(uniforms.shapeType, config.shape === "triangle" ? 1 : 0);
    
    gl.bindVertexArray(batch.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, batch.capacity);
    gl.bindVertexArray(null);
  });
};

/**
 * Clears all bullet batches.
 */
export const clearAllBulletBatches = (): void => {
  batches.forEach((batch) => {
    batch.activeCount = 0;
    batch.freeSlots.length = 0;
    for (let i = batch.capacity - 1; i >= 0; i -= 1) {
      batch.instances[i] = null;
      batch.freeSlots.push(i);
      batch.instanceData[i * INSTANCE_FLOATS + 4] = 0;
    }
    batch.needsUpload = true;
  });
};

// ============================================================================
// Default Visual Configs
// ============================================================================

export const DEFAULT_BULLET_VISUAL: BulletVisualConfig = {
  visualKey: "default",
  bodyColor: { r: 0.4, g: 0.6, b: 1.0, a: 1.0 },
  tailStartColor: { r: 0.25, g: 0.45, b: 1.0, a: 0.65 },
  tailEndColor: { r: 0.05, g: 0.15, b: 0.6, a: 0.0 },
  tailLengthMultiplier: 4.5,
  tailWidthMultiplier: 1.75,
  shape: "circle",
};

export const createBulletVisualConfig = (
  visualKey: string,
  overrides: Partial<Omit<BulletVisualConfig, "visualKey">> = {}
): BulletVisualConfig => ({
  ...DEFAULT_BULLET_VISUAL,
  ...overrides,
  visualKey,
});

