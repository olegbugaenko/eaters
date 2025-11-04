let petalAuraGlContext: WebGL2RenderingContext | null = null;

export const setPetalAuraGlContext = (
  gl: WebGL2RenderingContext | null,
): void => {
  petalAuraGlContext = gl;
};

export const getPetalAuraGlContext = (): WebGL2RenderingContext | null => petalAuraGlContext;

