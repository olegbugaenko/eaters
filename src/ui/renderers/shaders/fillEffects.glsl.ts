/**
 * Shared GLSL functions for fill effects (noise, filaments, etc.)
 * WebGL 2 (GLSL ES 3.0) syntax
 * Import and concatenate with your shader code.
 */

// ============================================================================
// CORE NOISE FUNCTIONS (no dependencies on varyings)
// ============================================================================

export const CORE_NOISE_GLSL = `
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

float fiber(vec2 p, float freq, float phase, float warpStrength) {
  // Create wavy line with noise displacement
  float warp = noise2d(p * 0.3 + phase) * warpStrength;
  float wave = sin(p.y * freq + warp * 10.0 + phase);
  return wave * 0.5 + 0.5;
}

float filamentNoise(vec2 p, float density) {
  float scale = density * 0.02;
  vec2 sp = p * scale;
  
  // Rotate coordinates by noise for organic flow
  float angle = noise2d(sp * 0.5) * 6.28;
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = vec2(sp.x * c - sp.y * s, sp.x * s + sp.y * c);
  
  // Multiple fiber layers at different angles and frequencies
  float f1 = fiber(rotated, 3.0, 0.0, 1.5);
  float f2 = fiber(rotated, 4.5, 2.1, 1.2);
  float f3 = fiber(rotated, 2.2, 4.7, 1.8);
  
  // Combine fibers - take maximum for distinct lines
  float combined = max(max(f1, f2), f3);
  
  return combined;
}
`;

// ============================================================================
// VERTEX SHADER COMPONENTS
// ============================================================================

export const SCENE_VERTEX_SHADER_HEADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec4 a_fillInfo;
in vec4 a_fillParams0;
in vec4 a_fillParams1;
in vec4 a_filaments0;
in float a_filamentEdgeBlur;
in vec3 a_stopOffsets;
in vec4 a_stopColor0;
in vec4 a_stopColor1;
in vec4 a_stopColor2;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;

out vec2 v_worldPosition;
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec4 v_filaments0;
out float v_filamentEdgeBlur;
out vec3 v_stopOffsets;
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
`;

export const SCENE_VERTEX_SHADER_MAIN = `
vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  gl_Position = vec4(toClip(a_position), 0.0, 1.0);
  v_worldPosition = a_position;
  v_fillInfo = a_fillInfo;
  v_fillParams0 = a_fillParams0;
  v_fillParams1 = a_fillParams1;
  v_filaments0 = a_filaments0;
  v_filamentEdgeBlur = a_filamentEdgeBlur;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
}
`;

export const SCENE_VERTEX_SHADER = SCENE_VERTEX_SHADER_HEADER + SCENE_VERTEX_SHADER_MAIN;

// ============================================================================
// FRAGMENT SHADER COMPONENTS
// ============================================================================

export const SCENE_FRAGMENT_SHADER_HEADER = `#version 300 es
precision highp float;

in vec2 v_worldPosition;
in vec4 v_fillInfo;
in vec4 v_fillParams0;
in vec4 v_fillParams1;
in vec4 v_filaments0;
in float v_filamentEdgeBlur;
in vec3 v_stopOffsets;
in vec4 v_stopColor0;
in vec4 v_stopColor1;
in vec4 v_stopColor2;

out vec4 fragColor;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}
`;

// Legacy exports for backwards compatibility
export const FILL_NOISE_GLSL = CORE_NOISE_GLSL;
export const FILL_FILAMENTS_GLSL = ``;

// Default noise anchor implementation
export const DEFAULT_NOISE_ANCHOR = `
  if (fillType < 3.5) {
    return v_fillParams0.xy;
  }
  return v_worldPosition;
`;

export const createNoiseAnchorGLSL = (noiseAnchorFn: string = DEFAULT_NOISE_ANCHOR) => `
vec2 resolveNoiseAnchor(float fillType) {
  ${noiseAnchorFn}
}
`;

export const APPLY_FILL_NOISE_GLSL = `
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
  
  float n = filamentNoise(pos, density);
  
  float threshold = 1.0 - width;
  float edge = threshold - edgeBlur * 0.3;
  
  float filament = smoothstep(edge, threshold, n);
  float signedVal = (filament - 0.5) * 2.0;

  if (colorContrast > 0.0) {
    color.rgb = clamp(color.rgb + signedVal * colorContrast, 0.0, 1.0);
  }
  if (alphaContrast > 0.0) {
    color.a = clamp(color.a + signedVal * alphaContrast, 0.0, 1.0);
  }

  return color;
}
`;

export const SAMPLE_GRADIENT_GLSL = `
vec4 sampleGradient(float t) {
  float stopCount = v_fillInfo.y;
  vec4 color0 = v_stopColor0;
  if (stopCount < 1.5) {
    return color0;
  }

  float offset0 = v_stopOffsets.x;
  float offset1 = v_stopOffsets.y;
  vec4 color1 = v_stopColor1;

  if (stopCount < 2.5) {
    if (t <= offset0) return color0;
    if (t >= offset1) return color1;
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float offset2 = v_stopOffsets.z;
  vec4 color2 = v_stopColor2;

  if (t <= offset0) return color0;
  if (t >= offset2) return color2;
  if (t <= offset1) {
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }

  float range = max(offset2 - offset1, 0.0001);
  float factor = clamp((t - offset1) / range, 0.0, 1.0);
  return mix(color1, color2, factor);
}
`;

export const SCENE_FRAGMENT_SHADER_MAIN = `
void main() {
  float fillType = v_fillInfo.x;
  vec4 color = v_stopColor0;

  if (fillType >= 0.5) {
    float t = 0.0;
    if (fillType < 1.5) {
      vec2 start = v_fillParams0.xy;
      vec2 dir = v_fillParams1.xy;
      float invLenSq = v_fillParams1.z;
      if (invLenSq > 0.0) {
        float projection = dot(v_worldPosition - start, dir) * invLenSq;
        t = clamp01(projection);
      }
    } else if (fillType < 2.5) {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      float dist = length(v_worldPosition - center);
      t = clamp01(dist / radius);
    } else {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      vec2 diff = v_worldPosition - center;
      float dist = abs(diff.x) + abs(diff.y);
      t = clamp01(dist / radius);
    }
    color = sampleGradient(t);
  }

  color = applyFillNoise(applyFillFilaments(color));
  fragColor = color;
}
`;

/**
 * Complete fill effects GLSL for fragment shader (without header)
 */
export const createFillEffectsGLSL = (noiseAnchorFn: string = DEFAULT_NOISE_ANCHOR) => 
  CORE_NOISE_GLSL + 
  createNoiseAnchorGLSL(noiseAnchorFn) + 
  APPLY_FILL_NOISE_GLSL + 
  APPLY_FILL_FILAMENTS_GLSL;

/**
 * Complete scene fragment shader
 */
export const createSceneFragmentShader = (noiseAnchorFn: string = DEFAULT_NOISE_ANCHOR) =>
  SCENE_FRAGMENT_SHADER_HEADER +
  createFillEffectsGLSL(noiseAnchorFn) +
  SAMPLE_GRADIENT_GLSL +
  SCENE_FRAGMENT_SHADER_MAIN;

