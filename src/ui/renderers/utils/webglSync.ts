import type { ObjectsRendererManager } from "../objects";

/**
 * Applies sync instructions from ObjectsRendererManager to WebGL buffers.
 * This function handles updating static and dynamic buffers based on
 * changes in the scene objects.
 * 
 * @param gl - WebGL2 rendering context
 * @param objectsRenderer - The renderer manager that provides sync instructions
 * @param staticBuffer - WebGL buffer for static geometry
 * @param dynamicBuffer - WebGL buffer for dynamic geometry
 */
export function applySyncInstructions(
  gl: WebGL2RenderingContext,
  objectsRenderer: ObjectsRendererManager,
  staticBuffer: WebGLBuffer,
  dynamicBuffer: WebGLBuffer
): void {
  // Update auto-animating objects (time-based animations) before syncing
  objectsRenderer.tickAutoAnimating();
  
  const sync = objectsRenderer.consumeSyncInstructions();
  
  if (sync.staticData) {
    gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sync.staticData, gl.STATIC_DRAW);
  }
  
  if (sync.dynamicData) {
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sync.dynamicData, gl.DYNAMIC_DRAW);
  } else if (sync.dynamicUpdates.length > 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    sync.dynamicUpdates.forEach(({ offset, data }) => {
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        offset * Float32Array.BYTES_PER_ELEMENT,
        data
      );
    });
  }
}
