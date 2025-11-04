let particleEmitterGl: WebGL2RenderingContext | null = null;

export const setParticleEmitterGlContext = (
  context: WebGL2RenderingContext | null
): void => {
  particleEmitterGl = context;
};

export const getParticleEmitterGlContext = (): WebGL2RenderingContext | null =>
  particleEmitterGl;
