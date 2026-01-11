/**
 * Global debug stats store - allows SceneDebugPanel to read values
 * without triggering React re-renders via props.
 * 
 * Values are written by useSceneCanvas and read by SceneDebugPanel
 * via direct DOM manipulation (refs).
 */

export interface DebugStats {
  vboBytes: number;
  vboReallocs: number;
  particleActive: number;
  particleCapacity: number;
  particleEmitters: number;
  movableObjects: number;
  // FPS tracking - updated by render loop
  frameCount: number;
  lastFpsUpdate: number;
  currentFps: number;
}

/** Global mutable stats object - written by render loop, read by debug panel */
export const debugStats: DebugStats = {
  vboBytes: 0,
  vboReallocs: 0,
  particleActive: 0,
  particleCapacity: 0,
  particleEmitters: 0,
  movableObjects: 0,
  frameCount: 0,
  lastFpsUpdate: 0,
  currentFps: 0,
};

/** Update VBO stats (called from useSceneCanvas) */
export const updateVboStats = (bytes: number, reallocs: number): void => {
  debugStats.vboBytes = bytes;
  debugStats.vboReallocs = reallocs;
};

/** Update particle stats (called from useSceneCanvas) */
export const updateParticleStats = (
  active: number,
  capacity: number,
  emitters: number
): void => {
  debugStats.particleActive = active;
  debugStats.particleCapacity = capacity;
  debugStats.particleEmitters = emitters;
};

/** Update movable objects count (called from useSceneCanvas) */
export const updateMovableStats = (count: number): void => {
  debugStats.movableObjects = count;
};

/** 
 * Increment frame counter - called every frame from render loop.
 * FPS is calculated lazily when read.
 */
export const tickFrame = (): void => {
  debugStats.frameCount++;
  const now = performance.now();
  const elapsed = now - debugStats.lastFpsUpdate;
  if (elapsed >= 1000) {
    debugStats.currentFps = Math.round((debugStats.frameCount / elapsed) * 1000);
    debugStats.frameCount = 0;
    debugStats.lastFpsUpdate = now;
  }
};
