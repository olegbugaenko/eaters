let whirlGlContext: WebGL2RenderingContext | null = null;

export const setWhirlGlContext = (
  gl: WebGL2RenderingContext | null,
): void => {
  whirlGlContext = gl;
};

export const getWhirlGlContext = (): WebGL2RenderingContext | null => whirlGlContext;
