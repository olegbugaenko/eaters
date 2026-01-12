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
  dynamicBuffer: WebGLBuffer,
  bufferState: { staticBytes: number; dynamicBytes: number }
): { staticBytes: number; dynamicBytes: number } {
  // Update auto-animating objects (time-based animations) before syncing
  objectsRenderer.tickAutoAnimating();
  
  const sync = objectsRenderer.consumeSyncInstructions();
  
  if (sync.staticData) {
    const staticBytes = sync.staticData.byteLength;
    gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer);
    if (staticBytes > bufferState.staticBytes) {
      gl.bufferData(gl.ARRAY_BUFFER, sync.staticData, gl.STATIC_DRAW);
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sync.staticData);
    }
    bufferState.staticBytes = staticBytes;
  }
  
  if (sync.dynamicData) {
    const usedLength = Math.min(
      sync.dynamicData.length,
      Math.max(sync.dynamicUsedLength, 0)
    );
    const dynamicData =
      usedLength > 0 ? sync.dynamicData.subarray(0, usedLength) : null;
    const dynamicBytes = dynamicData ? dynamicData.byteLength : 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    if (dynamicBytes > 0) {
      if (dynamicBytes > bufferState.dynamicBytes) {
        gl.bufferData(gl.ARRAY_BUFFER, dynamicData!, gl.DYNAMIC_DRAW);
      } else {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynamicData!);
      }
    }
    bufferState.dynamicBytes = dynamicBytes;
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
  return bufferState;
}
