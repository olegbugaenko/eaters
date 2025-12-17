/**
 * Shared GLSL functions for fill effects (noise, filaments, etc.)
 * Import and concatenate with your shader code.
 */

export const FILL_NOISE_GLSL = `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float ab = mix(a, b, u.x);
  float cd = mix(c, d, u.x);
  return mix(ab, cd, u.y);
}
`;

export const FILL_FILAMENTS_GLSL = `
float ridgeNoise(vec2 p) {
  // Ridge noise creates vein-like structures
  return 1.0 - abs(noise2d(p) * 2.0 - 1.0);
}

float filamentNoise(vec2 p, float density) {
  float scale = density * 0.03;
  vec2 sp = p * scale;
  
  // Domain warping - warp coordinates with noise for organic flow
  vec2 warp = vec2(
    noise2d(sp + vec2(0.0, 0.0)),
    noise2d(sp + vec2(5.2, 1.3))
  );
  vec2 warped = sp + warp * 0.5;
  
  // Layered ridge noise for filament structure
  float n = 0.0;
  n += ridgeNoise(warped * 1.0) * 0.6;
  n += ridgeNoise(warped * 2.0) * 0.3;
  n += ridgeNoise(warped * 4.0) * 0.1;
  
  return n;
}
`;

/**
 * Creates the applyFillNoise function for shaders.
 * @param noiseAnchorFn - How to resolve noise anchor (varies by shader)
 */
export const createApplyFillNoiseGLSL = (noiseAnchorFn: string) => `
vec2 resolveNoiseAnchor(float fillType) {
  ${noiseAnchorFn}
}

vec4 applyFillNoise(vec4 color) {
  float colorAmp = v_fillInfo.z;
  float alphaAmp = v_fillInfo.w;
  if (colorAmp <= 0.0 && alphaAmp <= 0.0) {
    return color;
  }
  float scale = v_fillParams1.w;
  float effectiveScale = scale > 0.0 ? scale : 1.0;
  float fillType = v_fillInfo.x;
  vec2 anchor = resolveNoiseAnchor(fillType);
  float noiseValue = noise2d((v_worldPosition - anchor) * effectiveScale) * 2.0 - 1.0;
  if (colorAmp > 0.0) {
    color.rgb = clamp(color.rgb + noiseValue * colorAmp, 0.0, 1.0);
  }
  if (alphaAmp > 0.0) {
    color.a = clamp(color.a + noiseValue * alphaAmp, 0.0, 1.0);
  }
  return color;
}
`;

/**
 * Creates the applyFillFilaments function for shaders.
 * Requires: noise2d, ridgeNoise, filamentNoise, resolveNoiseAnchor
 */
export const APPLY_FILL_FILAMENTS_GLSL = `
vec4 applyFillFilaments(vec4 color) {
  float colorContrast = v_filaments0.x;
  float alphaContrast = v_filaments0.y;
  float width = clamp(v_filaments0.z, 0.0, 1.0);
  float density = v_filaments0.w;
  float edgeBlur = clamp(v_filamentEdgeBlur, 0.0, 1.0);

  if ((colorContrast <= 0.0 && alphaContrast <= 0.0) || density <= 0.0) {
    return color;
  }

  vec2 anchor = resolveNoiseAnchor(v_fillInfo.x);
  vec2 pos = v_worldPosition - anchor;
  
  // Get filament pattern
  float n = filamentNoise(pos, density);
  
  // width controls how much of the filament is visible
  // Higher width = thicker filaments
  float threshold = 1.0 - width;
  float edge = threshold - edgeBlur * 0.3;
  
  // Create filament with smooth edges
  float filament = smoothstep(edge, threshold, n);
  
  // Convert to signed value
  float signed = (filament - 0.5) * 2.0;

  if (colorContrast > 0.0) {
    color.rgb = clamp(color.rgb + signed * colorContrast, 0.0, 1.0);
  }
  if (alphaContrast > 0.0) {
    color.a = clamp(color.a + signed * alphaContrast, 0.0, 1.0);
  }

  return color;
}
`;

// Default noise anchor implementation for most shaders
export const DEFAULT_NOISE_ANCHOR = `
  if (fillType < 3.5) {
    return v_fillParams0.xy;
  }
  return v_worldPosition;
`;

/**
 * Complete fill effects GLSL bundle with all functions
 */
export const createFillEffectsGLSL = (noiseAnchorFn: string = DEFAULT_NOISE_ANCHOR) => 
  FILL_NOISE_GLSL + 
  FILL_FILAMENTS_GLSL + 
  createApplyFillNoiseGLSL(noiseAnchorFn) + 
  APPLY_FILL_FILAMENTS_GLSL;

