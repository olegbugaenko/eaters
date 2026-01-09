/**
 * GPU Instanced Bullet Renderer
 * Renders all bullets of the same visual type in a single draw call
 * 
 * Unified API: extends GpuBatchRenderer for consistent lifecycle and slot management
 */

import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  BULLET_SPRITE_PATHS,
  BULLET_SPRITE_SIZE,
} from "@logic/services/bullet-render-bridge/bullet-sprites.const";
import { GpuBatchRenderer, type SlotHandle } from "../../core/GpuBatchRenderer";
import { compileProgram, UNIT_QUAD_CENTERED } from "../../core/BaseGpuPrimitive";
import type {
  BulletInstance,
  BulletBatch,
  BulletBatchConfig,
  BulletSharedResources,
} from "./bullet.types";
import {
  DEFAULT_BATCH_CAPACITY,
  INSTANCE_FLOATS,
  INSTANCE_STRIDE,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
  DEFAULT_BULLET_VISUAL,
} from "./bullet.const";

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
