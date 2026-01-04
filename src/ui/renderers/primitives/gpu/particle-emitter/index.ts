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
