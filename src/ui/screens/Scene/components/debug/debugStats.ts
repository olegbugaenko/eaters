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
}

/** Global mutable stats object - written by render loop, read by debug panel */
export const debugStats: DebugStats = {
  vboBytes: 0,
  vboReallocs: 0,
  particleActive: 0,
  particleCapacity: 0,
  particleEmitters: 0,
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
