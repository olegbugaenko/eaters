/**
 * GPU Instanced Bullet Renderer
 * Renders all bullets of the same visual type in a single draw call
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneColor, SceneSize, SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import {
  BULLET_SPRITE_PATHS,
  BULLET_SPRITE_SIZE,
  type BulletSpriteName,
} from "@logic/services/bullet-render-bridge/bullet-sprites.const";
import { GpuBatchRenderer, type SlotHandle } from "../core/GpuBatchRenderer";
import type { ExtendedGpuBatch } from "../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_CENTERED } from "../core/BaseGpuPrimitive";

// ============================================================================
// Types
// ============================================================================

export type BulletShape = "circle" | "sprite";

export interface BulletVisualConfig {
  /** Unique key identifying this visual type (e.g., "default", "ice", "fire") */
  readonly visualKey: string;
  /** Base color for the bullet body (used if centerColor not set) */
  readonly bodyColor: SceneColor;
  /** Color at the start of the tail (near bullet) */
  readonly tailStartColor: SceneColor;
  /** Color at the end of the tail (fading out) */
  readonly tailEndColor: SceneColor;
  /** Tail length multiplier relative to bullet radius */
  readonly tailLengthMultiplier: number;
  /** Tail width multiplier relative to bullet radius */
  readonly tailWidthMultiplier: number;
  /** Tail offset along movement axis (positive = forward, negative = backward) */
  readonly tailOffsetMultiplier?: number;
  /** Shape: "circle" for procedural, "sprite" for texture */
  readonly shape: BulletShape;
  /** If set, body uses radial gradient from center to edge */
  readonly centerColor?: SceneColor;
  readonly edgeColor?: SceneColor;
  /** Sprite name (converted to index by logic layer) */
  readonly spriteName?: BulletSpriteName;
  /** Sprite index in texture array (used when shape === "sprite") */
  readonly spriteIndex?: number;
}

export interface BulletInstance {
  position: SceneVector2;
  rotation: number;
  radius: number;
  active: boolean;
}

export interface BulletBatchConfig {
  batchKey: string;
  config: BulletVisualConfig;
}

interface BulletBatch extends ExtendedGpuBatch<BulletInstance> {
  visualKey: string;
  config: BulletVisualConfig;
}

interface BulletSharedResources {
  program: WebGLProgram;
  quadBuffer: WebGLBuffer;
  spriteTexture: WebGLTexture | null;
  spriteCount: number;
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    bodyColor: WebGLUniformLocation | null;
    tailStartColor: WebGLUniformLocation | null;
    tailEndColor: WebGLUniformLocation | null;
    tailLengthMul: WebGLUniformLocation | null;
    tailWidthMul: WebGLUniformLocation | null;
    shapeType: WebGLUniformLocation | null;
    centerColor: WebGLUniformLocation | null;
    edgeColor: WebGLUniformLocation | null;
    useRadialGradient: WebGLUniformLocation | null;
    spriteArray: WebGLUniformLocation | null;
    spriteIndex: WebGLUniformLocation | null;
    tailOffsetMul: WebGLUniformLocation | null;
  };
  attributes: {
    unitPosition: number;
    instancePosition: number;
    instanceRotation: number;
    instanceRadius: number;
    instanceActive: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BATCH_CAPACITY = 256;

// Instance data layout: posX, posY, rotation, radius, active
const INSTANCE_FLOATS = 5;
const INSTANCE_STRIDE = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

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
uniform float u_tailOffsetMul;
uniform int u_shapeType; // 0 = circle, 1 = sprite

// Outputs
out vec2 v_localPos;
out vec2 v_uv;
out float v_radius;
out float v_tailLength;
out float v_tailWidth;
out float v_tailOffset;

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
  float tailOffset = a_instanceRadius * u_tailOffsetMul;
  
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
  // UV for sprite sampling: map [-1,1] to [0,1]
  v_uv = a_unitPosition * 0.5 + 0.5;
  v_radius = a_instanceRadius;
  v_tailLength = tailLength;
  v_tailWidth = tailWidth;
  v_tailOffset = tailOffset;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPos;
in vec2 v_uv;
in float v_radius;
in float v_tailLength;
in float v_tailWidth;
in float v_tailOffset;

uniform vec4 u_bodyColor;
uniform vec4 u_tailStartColor;
uniform vec4 u_tailEndColor;
uniform int u_shapeType; // 0 = circle, 1 = sprite
uniform vec4 u_centerColor;
uniform vec4 u_edgeColor;
uniform int u_useRadialGradient;
uniform highp sampler2DArray u_spriteArray;
uniform int u_spriteIndex;

out vec4 fragColor;

void main() {
  float scaleX = v_radius + v_tailLength;
  float scaleY = max(v_radius, v_tailWidth);
  
  // Convert back to world-relative coords
  vec2 pos = v_localPos * vec2(scaleX, scaleY);
  
  // Distance from center for body
  float dist = length(pos);
  
  // Body (circle or sprite at front)
  if (u_shapeType == 0) {
    // Circle body
    if (dist < v_radius) {
      float edge = smoothstep(v_radius, v_radius - 1.0, dist);
      
      // Radial gradient or solid color
      vec4 bodyCol;
      if (u_useRadialGradient == 1) {
        float t = dist / v_radius;
        bodyCol = mix(u_centerColor, u_edgeColor, t);
      } else {
        bodyCol = u_bodyColor;
      }
      
      fragColor = vec4(bodyCol.rgb, bodyCol.a * edge);
      return;
    }
  } else {
    // Sprite body - sample from texture array
    // pos is in world-relative coords (pixels)
    
    // Sprite is square, sized to be visible (3x radius so it's not too tiny)
    float spriteHalf = v_radius;
    
    // Sprite center is at origin (where bullet center is)
    if (abs(pos.x) < spriteHalf && abs(pos.y) < spriteHalf) {
      // Map pos to UV [0,1]
      // pos.x from -spriteHalf to +spriteHalf -> u from 0 to 1
      float u = (pos.x / spriteHalf) * 0.5 + 0.5;
      float v = (pos.y / spriteHalf) * 0.5 + 0.5;
      // Flip V for correct orientation (texture Y is inverted)
      v = 1.0 - v;
      
      vec4 spriteColor = texture(u_spriteArray, vec3(u, v, float(u_spriteIndex)));
      if (spriteColor.a > 0.01) {
        fragColor = spriteColor;
        return;
      }
    }
  }
  
  // Tail (behind the bullet, with offset)
  // tailOffset > 0 moves tail forward, < 0 moves it backward
  float tailStartX = v_tailOffset;
  float tailEndX = v_tailOffset - v_tailLength;
  
  if (pos.x < tailStartX && pos.x > tailEndX) {
    float t = (tailStartX - pos.x) / v_tailLength; // 0 at start, 1 at end
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
// BulletGpuRenderer Class
// ============================================================================

/**
 * GPU renderer for bullets.
 * Uses instanced rendering with configurable visuals per batch.
 */
class BulletGpuRenderer extends GpuBatchRenderer<BulletInstance, BulletBatch, BulletBatchConfig> {
  private sharedResourcesExtended: BulletSharedResources | null = null;

  constructor() {
    super(DEFAULT_BATCH_CAPACITY);
  }

  protected createSharedResources(gl: WebGL2RenderingContext): { program: WebGLProgram } | null {
    const programResult = compileProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER, "[BulletGpu]");
    if (!programResult) {
      return null;
    }

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      gl.deleteProgram(programResult.program);
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_CENTERED, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const uniforms = {
      cameraPosition: gl.getUniformLocation(programResult.program, "u_cameraPosition"),
      viewportSize: gl.getUniformLocation(programResult.program, "u_viewportSize"),
      bodyColor: gl.getUniformLocation(programResult.program, "u_bodyColor"),
      tailStartColor: gl.getUniformLocation(programResult.program, "u_tailStartColor"),
      tailEndColor: gl.getUniformLocation(programResult.program, "u_tailEndColor"),
      tailLengthMul: gl.getUniformLocation(programResult.program, "u_tailLengthMul"),
      tailWidthMul: gl.getUniformLocation(programResult.program, "u_tailWidthMul"),
      shapeType: gl.getUniformLocation(programResult.program, "u_shapeType"),
      centerColor: gl.getUniformLocation(programResult.program, "u_centerColor"),
      edgeColor: gl.getUniformLocation(programResult.program, "u_edgeColor"),
      useRadialGradient: gl.getUniformLocation(programResult.program, "u_useRadialGradient"),
      spriteArray: gl.getUniformLocation(programResult.program, "u_spriteArray"),
      spriteIndex: gl.getUniformLocation(programResult.program, "u_spriteIndex"),
      tailOffsetMul: gl.getUniformLocation(programResult.program, "u_tailOffsetMul"),
    };

    const attributes = {
      unitPosition: gl.getAttribLocation(programResult.program, "a_unitPosition"),
      instancePosition: gl.getAttribLocation(programResult.program, "a_instancePosition"),
      instanceRotation: gl.getAttribLocation(programResult.program, "a_instanceRotation"),
      instanceRadius: gl.getAttribLocation(programResult.program, "a_instanceRadius"),
      instanceActive: gl.getAttribLocation(programResult.program, "a_instanceActive"),
    };

    this.sharedResourcesExtended = {
      program: programResult.program,
      quadBuffer,
      spriteTexture: null,
      spriteCount: 0,
      uniforms,
      attributes,
    };

    // Load sprites asynchronously
    this.loadSpriteArray(gl);

    return { program: programResult.program };
  }

  private loadSpriteArray(gl: WebGL2RenderingContext): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const texture = gl.createTexture();
    if (!texture) {
      return;
    }

    this.sharedResourcesExtended.spriteTexture = texture;
    this.sharedResourcesExtended.spriteCount = BULLET_SPRITE_PATHS.length;

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

    // Allocate texture array storage
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGBA,
      BULLET_SPRITE_SIZE,
      BULLET_SPRITE_SIZE,
      BULLET_SPRITE_PATHS.length,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Load each sprite image
    BULLET_SPRITE_PATHS.forEach((path: string, index: number) => {
      const image = new Image();
      image.onload = () => {
        // Check if context/resources are still valid and texture wasn't deleted
        if (gl !== this.gl || !this.sharedResourcesExtended || !this.sharedResourcesExtended.spriteTexture) {
          return; // Context changed or texture was deleted
        }

        try {
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.sharedResourcesExtended.spriteTexture);
          gl.texSubImage3D(
            gl.TEXTURE_2D_ARRAY,
            0,
            0, 0, index,
            BULLET_SPRITE_SIZE,
            BULLET_SPRITE_SIZE,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
          );
        } catch (error) {
          // Texture was deleted or context lost - silently ignore
        }
      };
      image.onerror = () => {
        console.error(`[BulletGpu] Failed to load sprite: ${path}`);
      };
      image.src = path;
    });

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }

  protected createBatch(gl: WebGL2RenderingContext, capacity: number): BulletBatch | null {
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

    // Unit quad (per-vertex)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sharedResourcesExtended.quadBuffer);
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.unitPosition);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.unitPosition, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.unitPosition, 0);

    // Instance buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

    // Instance attributes
    let offset = 0;

    // position (vec2)
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.instancePosition);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.instancePosition, 2, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.instancePosition, 1);
    offset += 2 * 4;

    // rotation (float)
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.instanceRotation);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.instanceRotation, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.instanceRotation, 1);
    offset += 1 * 4;

    // radius (float)
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.instanceRadius);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.instanceRadius, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.instanceRadius, 1);
    offset += 1 * 4;

    // active (float)
    gl.enableVertexAttribArray(this.sharedResourcesExtended.attributes.instanceActive);
    gl.vertexAttribPointer(this.sharedResourcesExtended.attributes.instanceActive, 1, gl.FLOAT, false, INSTANCE_STRIDE, offset);
    gl.vertexAttribDivisor(this.sharedResourcesExtended.attributes.instanceActive, 1);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const freeSlots: number[] = [];
    for (let i = capacity - 1; i >= 0; i--) {
      freeSlots.push(i);
    }

    return {
      gl,
      visualKey: "", // Will be set in acquireSlot
      config: DEFAULT_BULLET_VISUAL,
      capacity,
      instanceBuffer,
      vao,
      freeSlots,
      activeCount: 0,
      instances: new Array(capacity).fill(null),
      needsUpload: false,
      instanceData: new Float32Array(capacity * INSTANCE_FLOATS),
    };
  }

  protected getBatchKey(config: BulletBatchConfig): string {
    return config.batchKey;
  }

  protected writeInstanceData(batch: BulletBatch, slotIndex: number, instance: BulletInstance): void {
    const offset = slotIndex * INSTANCE_FLOATS;
    const data = batch.instanceData;

    data[offset + 0] = instance.position.x;
    data[offset + 1] = instance.position.y;
    data[offset + 2] = instance.rotation;
    data[offset + 3] = instance.radius;
    data[offset + 4] = instance.active ? 1 : 0;
  }

  protected setupRenderState(
    gl: WebGL2RenderingContext,
    batch: BulletBatch,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    _timestampMs: number
  ): void {
    if (!this.sharedResourcesExtended) {
      return;
    }

    const { uniforms, spriteTexture } = this.sharedResourcesExtended;
    const { config } = batch;

    // Camera uniforms (shared)
    if (uniforms.cameraPosition) {
      gl.uniform2f(uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
    }
    if (uniforms.viewportSize) {
      gl.uniform2f(uniforms.viewportSize, viewportSize.width, viewportSize.height);
    }

    // Batch-specific uniforms
    if (uniforms.bodyColor) {
      gl.uniform4f(uniforms.bodyColor, config.bodyColor.r, config.bodyColor.g, config.bodyColor.b, config.bodyColor.a ?? 1);
    }
    if (uniforms.tailStartColor) {
      gl.uniform4f(uniforms.tailStartColor, config.tailStartColor.r, config.tailStartColor.g, config.tailStartColor.b, config.tailStartColor.a ?? 1);
    }
    if (uniforms.tailEndColor) {
      gl.uniform4f(uniforms.tailEndColor, config.tailEndColor.r, config.tailEndColor.g, config.tailEndColor.b, config.tailEndColor.a ?? 0);
    }
    if (uniforms.tailLengthMul) {
      gl.uniform1f(uniforms.tailLengthMul, config.tailLengthMultiplier);
    }
    if (uniforms.tailWidthMul) {
      gl.uniform1f(uniforms.tailWidthMul, config.tailWidthMultiplier);
    }
    if (uniforms.tailOffsetMul) {
      gl.uniform1f(uniforms.tailOffsetMul, config.tailOffsetMultiplier ?? 0);
    }
    if (uniforms.shapeType) {
      gl.uniform1i(uniforms.shapeType, config.shape === "sprite" ? 1 : 0);
    }
    if (uniforms.spriteIndex) {
      gl.uniform1i(uniforms.spriteIndex, config.spriteIndex ?? 0);
    }

    // Radial gradient support
    const useRadial = config.centerColor && config.edgeColor ? 1 : 0;
    if (uniforms.useRadialGradient) {
      gl.uniform1i(uniforms.useRadialGradient, useRadial);
    }
    if (useRadial) {
      const cc = config.centerColor!;
      const ec = config.edgeColor!;
      if (uniforms.centerColor) {
        gl.uniform4f(uniforms.centerColor, cc.r, cc.g, cc.b, cc.a ?? 1);
      }
      if (uniforms.edgeColor) {
        gl.uniform4f(uniforms.edgeColor, ec.r, ec.g, ec.b, ec.a ?? 1);
      }
    }

    // Bind sprite texture array once for all batches
    if (spriteTexture && this.sharedResourcesExtended.spriteTexture === spriteTexture) {
      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, spriteTexture);
        if (uniforms.spriteArray) {
          gl.uniform1i(uniforms.spriteArray, 0);
        }
      } catch (error) {
        // Texture was deleted or context lost - skip texture binding
      }
    }

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  protected getInstanceFloats(): number {
    return INSTANCE_FLOATS;
  }

  protected getActiveFloatIndex(): number {
    return 4; // active flag
  }

  protected getVertexCount(_batch: BulletBatch): number {
    return 6; // TRIANGLES (UNIT_QUAD_CENTERED has 6 vertices)
  }

  protected getDrawMode(gl: WebGL2RenderingContext): number {
    return gl.TRIANGLES;
  }

  protected override disposeSharedResources(gl: WebGL2RenderingContext): void {
    if (this.sharedResourcesExtended?.quadBuffer) {
      gl.deleteBuffer(this.sharedResourcesExtended.quadBuffer);
    }
    if (this.sharedResourcesExtended?.spriteTexture) {
      gl.deleteTexture(this.sharedResourcesExtended.spriteTexture);
      this.sharedResourcesExtended.spriteTexture = null;
    }
    this.sharedResourcesExtended = null;
  }

  /**
   * Override acquireSlot to set batch config from BulletVisualConfig and return BulletSlotHandle.
   */
  public override acquireSlot(config: BulletBatchConfig): BulletSlotHandle | null {
    const handle = super.acquireSlot(config);
    if (!handle) {
      return null;
    }

    const batch = this.batches.get(handle.batchKey);
    if (batch) {
      // Store config in batch
      batch.visualKey = config.config.visualKey;
      batch.config = config.config;
      // Return handle with visualKey
      return { ...handle, visualKey: batch.visualKey };
    }

    return null;
  }

  /**
   * Override render to unbind texture after rendering.
   */
  public override render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void {
    super.render(gl, cameraPosition, viewportSize, timestampMs);

    // Unbind texture
    if (this.sharedResourcesExtended?.spriteTexture) {
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
  }
}

// ============================================================================
// Public API - Single instance with unified interface
// ============================================================================

export const bulletGpuRenderer = new BulletGpuRenderer();

// Re-export types
export interface BulletSlotHandle extends SlotHandle {
  visualKey: string;
}

// ============================================================================
// Helper functions for interpolation
// ============================================================================

/**
 * Gets all active bullets for interpolation snapshot sync.
 */
export const getAllActiveBullets = (): Array<{ handle: BulletSlotHandle; position: SceneVector2 }> => {
  const result: Array<{ handle: BulletSlotHandle; position: SceneVector2 }> = [];
  bulletGpuRenderer["batches"].forEach((batch, batchKey) => {
    for (let i = 0; i < batch.capacity; i++) {
      const instance = batch.instances[i];
      if (instance && instance.active) {
        result.push({
          handle: { batchKey, visualKey: batch.visualKey, slotIndex: i },
          position: { x: instance.position.x, y: instance.position.y },
        });
      }
    }
  });
  return result;
};

/**
 * Applies interpolated positions to bullets before rendering.
 */
export const applyInterpolatedBulletPositions = (
  interpolatedPositions: Map<string, SceneVector2>
): void => {
  if (interpolatedPositions.size === 0) return;

  interpolatedPositions.forEach((position, key) => {
    // Parse key: "batchKey:slotIndex"
    const parts = key.split(":");
    if (parts.length !== 2) return;
    const [batchKey, slotIndexStr] = parts;
    if (!batchKey || !slotIndexStr) return;

    const slotIndex = parseInt(slotIndexStr, 10);
    if (isNaN(slotIndex)) return;

    const batch = bulletGpuRenderer["batches"].get(batchKey);
    if (!batch) return;

    const instance = batch.instances[slotIndex];
    // CRITICAL: Only update if bullet is still active!
    if (!instance || !instance.active) return;

    // Update position
    instance.position.x = position.x;
    instance.position.y = position.y;

    const offset = slotIndex * INSTANCE_FLOATS;
    batch.instanceData[offset + 0] = position.x;
    batch.instanceData[offset + 1] = position.y;
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
