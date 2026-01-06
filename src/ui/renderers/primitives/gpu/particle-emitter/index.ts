export {
  particleEmitterGpuRenderer,
  getParticleRenderResources,
  disposeParticleRenderResources,
  clearAllParticleEmitters,
  getParticleStats,
  registerParticleEmitterHandle,
  unregisterParticleEmitterHandle,
  refreshParticleUniformKeys,
  uploadEmitterUniformsPublic,
  renderParticleEmitters,
} from "./ParticleEmitterGpuRenderer";
export type {
  ParticleEmitterGpuRenderUniforms,
  ParticleEmitterGpuDrawHandle,
  ParticleRenderResources,
  ParticleRenderProgram,
} from "./particle-emitter.types";

// Global Particle Pool
export {
  initGlobalParticlePool,
  disposeGlobalParticlePool,
  allocateSlots,
  freeSlots,
  getPoolStats,
  isPoolInitialized,
  getPoolCapacity,
  writeParticleData,
  clearSlotRange,
  getBufferForRange,
  getStateBuffers,
  getCurrentBufferIndex,
  setCurrentBufferIndex,
  swapBuffers,
  getSimulationResources,
  getRenderVao,
  getPoolGl,
  PARTICLE_STATE_COMPONENTS,
  PARTICLE_STATE_BYTES,
} from "./GlobalParticlePool";
export type {
  ParticleSlotRange,
  GlobalParticlePoolHandle,
} from "./GlobalParticlePool";