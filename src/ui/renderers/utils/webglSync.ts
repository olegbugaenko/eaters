import type { DynamicBufferUpdate, ObjectsRendererManager } from "../objects";

const MAX_MERGED_RANGES = 64;
const BLOCK_SIZE = 256;
const MAX_BUCKETS = 4096;
let dynamicUpdatesScratch: Float32Array | null = null;

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
    const bucketCount = Math.ceil(sync.dynamicUsedLength / BLOCK_SIZE);
    const canBucketize = bucketCount > 0 && bucketCount <= MAX_BUCKETS;
    const updates = canBucketize
      ? bucketizeDynamicUpdates(sync.dynamicUpdates, bucketCount)
      : sync.dynamicUpdatesSorted
        ? sync.dynamicUpdates
        : [...sync.dynamicUpdates].sort((a, b) => a.offset - b.offset);
    const merged = mergeDynamicUpdates(updates);
    if (merged.length > MAX_MERGED_RANGES) {
      const dynamicData = objectsRenderer.getDynamicData();
      if (dynamicData) {
        const usedLength = Math.min(
          dynamicData.length,
          Math.max(sync.dynamicUsedLength, 0)
        );
        const fullUpload = usedLength > 0 ? dynamicData.subarray(0, usedLength) : null;
        const dynamicBytes = fullUpload ? fullUpload.byteLength : 0;
        if (dynamicBytes > 0) {
          if (dynamicBytes > bufferState.dynamicBytes) {
            gl.bufferData(gl.ARRAY_BUFFER, fullUpload!, gl.DYNAMIC_DRAW);
          } else {
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, fullUpload!);
          }
        }
        bufferState.dynamicBytes = dynamicBytes;
        return bufferState;
      }
    }
    merged.forEach((range) => {
      if (range.updates.length === 1) {
        const update = range.updates[0]!;
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          update.offset * Float32Array.BYTES_PER_ELEMENT,
          update.data
        );
        return;
      }
      const rangeLength = range.end - range.offset;
      if (!dynamicUpdatesScratch || dynamicUpdatesScratch.length < rangeLength) {
        dynamicUpdatesScratch = new Float32Array(rangeLength);
      }
      const scratch = dynamicUpdatesScratch.subarray(0, rangeLength);
      range.updates.forEach((update) => {
        scratch.set(update.data, update.offset - range.offset);
      });
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        range.offset * Float32Array.BYTES_PER_ELEMENT,
        scratch
      );
    });
  }
  return bufferState;
}

function mergeDynamicUpdates(
  updates: DynamicBufferUpdate[]
): Array<{ offset: number; end: number; updates: DynamicBufferUpdate[] }> {
  const merged: Array<{ offset: number; end: number; updates: DynamicBufferUpdate[] }> = [];
  let current: { offset: number; end: number; updates: DynamicBufferUpdate[] } | null = null;

  updates.forEach((update) => {
    const updateStart = update.offset;
    const updateEnd = update.offset + update.data.length;
    if (!current) {
      current = { offset: updateStart, end: updateEnd, updates: [update] };
      return;
    }
    if (updateStart <= current.end) {
      current.end = Math.max(current.end, updateEnd);
      current.updates.push(update);
      return;
    }
    merged.push(current);
    current = { offset: updateStart, end: updateEnd, updates: [update] };
  });

  if (current) {
    merged.push(current);
  }

  return merged;
}

function bucketizeDynamicUpdates(
  updates: DynamicBufferUpdate[],
  bucketCount: number
): DynamicBufferUpdate[] {
  const buckets = Array.from({ length: bucketCount }, () => []);
  updates.forEach((update) => {
    const bucketIndex = Math.floor(update.offset / BLOCK_SIZE);
    const safeBucketIndex = Math.max(0, Math.min(bucketIndex, bucketCount - 1));
    buckets[safeBucketIndex]!.push(update);
  });
  const flattened: DynamicBufferUpdate[] = [];
  buckets.forEach((bucket) => {
    bucket.sort((a, b) => a.offset - b.offset);
    bucket.forEach((update) => {
      flattened.push(update);
    });
  });
  return flattened;
}
