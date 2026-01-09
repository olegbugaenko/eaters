/**
 * Core Primitive Types
 * 
 * Defines the standard interfaces and types for all primitives in the rendering system.
 * Primitives are the building blocks that generate vertex data for WebGL rendering.
 * 
 * There are two main categories:
 * 1. CPU Primitives - Generate vertex data on CPU, uploaded to GPU for rendering
 * 2. GPU Primitives - Use WebGL2 instanced rendering with GPU-side computations
 */

import type { SceneObjectInstance, SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

// ============================================================================
// Base Primitive Interface
// ============================================================================

/**
 * Base interface for all primitives.
 * Primitives should be disposable to properly clean up resources.
 */
export interface IPrimitive {
  /**
   * Release all resources held by this primitive.
   * After calling dispose(), the primitive should not be used.
   * Optional for simple primitives that don't hold external resources.
   */
  dispose?(): void;
}

// ============================================================================
// CPU Primitive Interfaces
// ============================================================================

/**
 * A primitive that produces vertex data for rendering.
 * The data is a Float32Array containing interleaved vertex attributes.
 */
export interface ICpuPrimitive extends IPrimitive {
  /**
   * The vertex data for this primitive.
   * Format: [x, y, ...fillComponents] per vertex.
   */
  readonly data: Float32Array;
}

/**
 * A static CPU primitive - vertex data is computed once at creation time.
 * Used for objects that don't change (e.g., static backgrounds, fixed shapes).
 */
export interface IStaticCpuPrimitive extends ICpuPrimitive {
  // Static primitives don't have update method - data is immutable after creation
}

/**
 * A dynamic CPU primitive - vertex data can be updated each frame.
 * Used for animated or moving objects.
 */
export interface IDynamicCpuPrimitive extends ICpuPrimitive {
  /**
   * Update the primitive's vertex data based on the object instance's current state.
   * 
   * @param instance - The scene object instance with current position, rotation, etc.
   * @returns The updated Float32Array if data changed, or null if no changes were made.
   */
  update(instance: SceneObjectInstance): Float32Array | null;

  /**
   * Optional cleanup method.
   * Override in primitives that hold external resources (GPU buffers, etc.)
   */
  dispose?(): void;
}

// ============================================================================
// GPU Primitive Interfaces
// ============================================================================

/**
 * Lifecycle interface for GPU-based instanced primitives.
 * These primitives render multiple instances in a single draw call using WebGL2 instancing.
 * 
 * Lifecycle:
 * 1. onContextAcquired - Called when WebGL context becomes available
 * 2. beforeRender - Called before each render frame (upload dirty data)
 * 3. render - Called to draw all instances
 * 4. onContextLost - Called when WebGL context is lost
 * 5. dispose - Called when primitive is no longer needed
 */
export interface IGpuPrimitiveLifecycle extends IPrimitive {
  /**
   * Called when WebGL2 context becomes available.
   * Initialize GPU resources (shaders, buffers, VAOs, etc.)
   */
  onContextAcquired(gl: WebGL2RenderingContext): void;

  /**
   * Called when WebGL context is lost.
   * Clean up GPU resources but keep instance data for potential restoration.
   */
  onContextLost(): void;

  /**
   * Called before rendering to upload any dirty instance data to GPU.
   * @param gl - The WebGL2 context
   * @param timestampMs - Current timestamp in milliseconds
   */
  beforeRender(gl: WebGL2RenderingContext, timestampMs: number): void;

  /**
   * Render all active instances.
   * @param gl - The WebGL2 context
   * @param cameraPosition - Camera position in world coordinates
   * @param viewportSize - Viewport dimensions
   * @param timestampMs - Current timestamp in milliseconds
   */
  render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timestampMs: number
  ): void;

  /**
   * Clear all instances from this primitive.
   */
  clearInstances(): void;
}

/**
 * Base interface for a GPU instance slot handle.
 * Used to track and update individual instances within a batch.
 */
export interface IGpuInstanceHandle {
  /** Unique identifier for the batch this instance belongs to */
  readonly batchKey: string;
  /** Index of this instance within the batch */
  readonly slotIndex: number;
}

/**
 * Configuration for creating a GPU batch.
 */
export interface IGpuBatchConfig {
  /** Initial capacity (number of instances) */
  readonly capacity: number;
  /** Whether the batch can grow dynamically */
  readonly canGrow?: boolean;
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * @deprecated Use IStaticCpuPrimitive instead. Kept for backward compatibility.
 */
export type StaticPrimitive = IStaticCpuPrimitive;

/**
 * @deprecated Use IDynamicCpuPrimitive instead. Kept for backward compatibility.
 */
export type DynamicPrimitive = IDynamicCpuPrimitive;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a primitive is a dynamic CPU primitive.
 */
export const isDynamicCpuPrimitive = (
  primitive: IPrimitive
): primitive is IDynamicCpuPrimitive => {
  return (
    "data" in primitive &&
    "update" in primitive &&
    typeof (primitive as IDynamicCpuPrimitive).update === "function"
  );
};

/**
 * Check if a primitive is a static CPU primitive.
 */
export const isStaticCpuPrimitive = (
  primitive: IPrimitive
): primitive is IStaticCpuPrimitive => {
  return (
    "data" in primitive &&
    !("update" in primitive && typeof (primitive as IDynamicCpuPrimitive).update === "function")
  );
};

/**
 * Check if a primitive has GPU lifecycle methods.
 */
export const isGpuPrimitive = (
  primitive: IPrimitive
): primitive is IGpuPrimitiveLifecycle => {
  return (
    "onContextAcquired" in primitive &&
    "render" in primitive &&
    typeof (primitive as IGpuPrimitiveLifecycle).onContextAcquired === "function" &&
    typeof (primitive as IGpuPrimitiveLifecycle).render === "function"
  );
};
