/**
 * Shared GLSL functions for fill effects (noise, filaments, etc.)
 * WebGL 2 (GLSL ES 3.0) syntax
 * Import and concatenate with your shader code.
 */

import { TO_CLIP_GLSL, CLAMP01_GLSL } from "./common.glsl";

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
precision highp int;

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
in vec2 a_crackUv;
in vec4 a_crackMask;
in vec2 a_crackEffects;
in vec4 a_colorXform;
in vec4 a_colorAnim0;
in vec4 a_colorAnim1;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform sampler2D u_spriteTexture;
uniform int u_crackAtlasIndex;
uniform vec2 u_crackAtlasGrid;

out vec2 v_worldPosition;
out vec2 v_uv; // UV coordinates for sprite textures
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec4 v_filaments0;
out float v_filamentEdgeBlur;
out vec3 v_stopOffsets;
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
out vec2 v_crackUv;
out vec4 v_crackMask;
out vec2 v_crackEffects;
out vec4 v_colorXform;
out vec4 v_colorAnim0;
out vec4 v_colorAnim1;
`;

export const SCENE_VERTEX_SHADER_MAIN = TO_CLIP_GLSL + `
void main() {
  gl_Position = vec4(toClip(a_position), 0.0, 1.0);
  v_worldPosition = a_position;
  // Use fillParams0.xy for UV coordinates when rendering sprites
  v_uv = a_fillParams0.xy;
  v_fillInfo = a_fillInfo;
  v_fillParams0 = a_fillParams0;
  v_fillParams1 = a_fillParams1;
  v_filaments0 = a_filaments0;
  v_filamentEdgeBlur = a_filamentEdgeBlur;
  v_stopOffsets = a_stopOffsets;
  v_stopColor0 = a_stopColor0;
  v_stopColor1 = a_stopColor1;
  v_stopColor2 = a_stopColor2;
  v_crackUv = a_crackUv;
  v_crackMask = a_crackMask;
  v_crackEffects = a_crackEffects;
  v_colorXform = a_colorXform;
  v_colorAnim0 = a_colorAnim0;
  v_colorAnim1 = a_colorAnim1;
}
`;

export const SCENE_VERTEX_SHADER = SCENE_VERTEX_SHADER_HEADER + SCENE_VERTEX_SHADER_MAIN;

// ============================================================================
// FRAGMENT SHADER COMPONENTS
// ============================================================================

export const SCENE_FRAGMENT_SHADER_HEADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_worldPosition;
in vec2 v_uv; // UV coordinates for sprite textures
in vec4 v_fillInfo;
in vec4 v_fillParams0;
in vec4 v_fillParams1;
in vec4 v_filaments0;
in float v_filamentEdgeBlur;
in vec3 v_stopOffsets;
in vec4 v_stopColor0;
in vec4 v_stopColor1;
in vec4 v_stopColor2;
in vec2 v_crackUv;
in vec4 v_crackMask;
in vec2 v_crackEffects;
in vec4 v_colorXform;
in vec4 v_colorAnim0;
in vec4 v_colorAnim1;

uniform sampler2D u_spriteTexture;
uniform sampler2D u_cracksAtlas;
uniform int u_crackAtlasIndex;
uniform vec2 u_crackAtlasGrid;
uniform float u_timeMs;

// Expanded 4-keyframe animation via uniform (set by PolygonGpuRenderer).
// Layout: [0]=(interval,count,0,0), [1..4]=keyframePart(time,mode,v0,v1),
//         [5]=(kf0.v2,kf0.v3,kf1.v2,kf1.v3), [6]=(kf2.v2,kf2.v3,kf3.v2,kf3.v3)
uniform vec4 u_colorAnimData[7];

out vec4 fragColor;

` + CLAMP01_GLSL;

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
  
  // noiseDensity is stored in v_fillParams1.y for non-linear fills
  // For linear gradient (fillType ~1), params1.y is dir.y, so use default 1.0
  float noiseDensity = (fillType > 0.5 && fillType < 1.5) ? 1.0 : v_fillParams1.y;
  noiseDensity = noiseDensity > 0.0 ? noiseDensity : 1.0;
  
  vec2 anchor = resolveNoiseAnchor(fillType);
  float rawNoise = noise2d((v_worldPosition - anchor) * effectiveScale);
  
  // Apply density: sparse out fluctuations when density < 1
  // density=1 -> all noise visible, density=0.1 -> only 10% visible
  float threshold = 1.0 - noiseDensity;
  float sparsedNoise = rawNoise > threshold ? (rawNoise - threshold) / max(noiseDensity, 0.001) : 0.0;
  float noiseValue = sparsedNoise * 2.0 - 1.0;
  
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
vec3 rgbToHsl(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  float maxC = max(max(r, g), b);
  float minC = min(min(r, g), b);
  float l = (maxC + minC) * 0.5;
  if (abs(maxC - minC) < 1e-6) {
    return vec3(0.0, 0.0, l);
  }
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  if (maxC == r) {
    h = (g - b) / d + (g < b ? 6.0 : 0.0);
  } else if (maxC == g) {
    h = (b - r) / d + 2.0;
  } else {
    h = (r - g) / d + 4.0;
  }
  h /= 6.0;
  return vec3(h, s, l);
}

float hueToRgb(float p, float q, float t) {
  float x = t;
  if (x < 0.0) x += 1.0;
  if (x > 1.0) x -= 1.0;
  if (x < 1.0 / 6.0) return p + (q - p) * 6.0 * x;
  if (x < 1.0 / 2.0) return q;
  if (x < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - x) * 6.0;
  return p;
}

vec3 hslToRgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s <= 0.0) {
    return vec3(l, l, l);
  }
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hueToRgb(p, q, h + 1.0 / 3.0),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1.0 / 3.0)
  );
}

float applyBrightness(float c, float b) {
  if (b > 0.0) return c + (1.0 - c) * b;
  if (b < 0.0) return c * (1.0 + b);
  return c;
}

vec4 applyTransform(vec4 color, float hueShift, float satShift, float brightShift, float alphaMul) {
  vec3 hsl = rgbToHsl(color.rgb);
  float h = fract(hsl.x + hueShift);
  float s = clamp(hsl.y + satShift, 0.0, 1.0);
  vec3 rgb = hslToRgb(vec3(h, s, hsl.z));
  rgb = vec3(
    clamp(applyBrightness(rgb.r, brightShift), 0.0, 1.0),
    clamp(applyBrightness(rgb.g, brightShift), 0.0, 1.0),
    clamp(applyBrightness(rgb.b, brightShift), 0.0, 1.0)
  );
  return vec4(rgb, clamp(color.a * alphaMul, 0.0, 1.0));
}

vec4 evalSingleKeyframe(vec4 baseColor, float mode, float v0, float v1, float v2, float v3) {
  if (mode < 0.5) {
    return applyTransform(baseColor, v0, v1, v2, 1.0);
  }
  return vec4(v0, v1, v2, v3);
}

vec4 applyExpandedColorAnimation(vec4 baseColor) {
  float interval = u_colorAnimData[0].x;
  int keyframeCount = int(floor(u_colorAnimData[0].y + 0.5));
  if (interval <= 0.0 || keyframeCount <= 0) {
    return baseColor;
  }
  float phase = fract(u_timeMs / max(interval, 1.0));

  if (keyframeCount == 1) {
    vec4 kp = u_colorAnimData[1];
    vec2 kt = u_colorAnimData[5].xy;
    return evalSingleKeyframe(baseColor, kp.y, kp.z, kp.w, kt.x, kt.y);
  }

  int left = 0;
  int right = 0;
  float leftTime = u_colorAnimData[1].x;
  float rightTime = leftTime;
  bool found = false;
  for (int i = 0; i < 4; i += 1) {
    if (i >= keyframeCount - 1) break;
    float a = u_colorAnimData[1 + i].x;
    float b = u_colorAnimData[2 + i].x;
    if (phase >= a && phase <= b) {
      left = i;
      right = i + 1;
      leftTime = a;
      rightTime = b;
      found = true;
      break;
    }
  }
  if (!found) {
    left = keyframeCount - 1;
    right = 0;
    leftTime = u_colorAnimData[1 + left].x;
    rightTime = u_colorAnimData[1].x + 1.0;
    if (phase < u_colorAnimData[1].x) {
      phase += 1.0;
    }
  }

  float span = max(rightTime - leftTime, 1e-6);
  float t = clamp((phase - leftTime) / span, 0.0, 1.0);

  vec4 lpk = u_colorAnimData[1 + left];
  int lTailIdx = 5 + left / 2;
  vec2 lTail = (left - (left / 2) * 2 == 0)
    ? u_colorAnimData[lTailIdx].xy : u_colorAnimData[lTailIdx].zw;
  vec4 c0 = evalSingleKeyframe(baseColor, lpk.y, lpk.z, lpk.w, lTail.x, lTail.y);

  vec4 rpk = u_colorAnimData[1 + right];
  int rTailIdx = 5 + right / 2;
  vec2 rTail = (right - (right / 2) * 2 == 0)
    ? u_colorAnimData[rTailIdx].xy : u_colorAnimData[rTailIdx].zw;
  vec4 c1 = evalSingleKeyframe(baseColor, rpk.y, rpk.z, rpk.w, rTail.x, rTail.y);

  return mix(c0, c1, t);
}

vec4 applyCompactColorAnimation(vec4 baseColor) {
  float interval = v_colorAnim0.x;
  int keyframeCount = int(floor(v_colorAnim0.y + 0.5));
  if (interval <= 0.0 || keyframeCount <= 0) {
    return baseColor;
  }

  float mode = v_colorAnim1.w;
  vec3 kf = v_colorAnim1.xyz;

  if (keyframeCount == 1) {
    if (mode < 0.5) {
      return applyTransform(baseColor, kf.x, kf.y, kf.z, 1.0);
    }
    return vec4(kf, 1.0);
  }

  float phase = fract(u_timeMs / max(interval, 1.0));

  if (keyframeCount >= 3) {
    float peakTime = v_colorAnim0.z;
    float endTime = v_colorAnim0.w;
    float strength;
    if (phase <= peakTime) {
      strength = peakTime > 0.001 ? phase / peakTime : 1.0;
    } else if (phase <= endTime) {
      float fadeSpan = max(endTime - peakTime, 0.001);
      strength = 1.0 - (phase - peakTime) / fadeSpan;
    } else {
      strength = 0.0;
    }
    strength = clamp(strength, 0.0, 1.0);
    if (mode < 0.5) {
      return applyTransform(baseColor, kf.x * strength, kf.y * strength, kf.z * strength, 1.0);
    }
    return mix(baseColor, vec4(kf, 1.0), strength);
  }

  float kf0Time = v_colorAnim0.z;
  float kf1Time = v_colorAnim0.w;
  float span = max(kf1Time - kf0Time, 0.001);
  float t = clamp((phase - kf0Time) / span, 0.0, 1.0);
  float strength = 1.0 - t;

  if (mode < 0.5) {
    return applyTransform(baseColor, kf.x * strength, kf.y * strength, kf.z * strength, 1.0);
  }
  return mix(vec4(kf, 1.0), baseColor, t);
}

vec4 applyColorAnimation(vec4 baseColor) {
  if (u_colorAnimData[0].x > 0.0) {
    return applyExpandedColorAnimation(baseColor);
  }
  return applyCompactColorAnimation(baseColor);
}

vec4 applyColorPipeline(vec4 color) {
  // Order (all fill branches, including sprite):
  // base fill sampling (solid/gradient/sprite) -> color transform (H/S/B + keyframe animation)
  // -> filaments/noise -> crack.
  // Policy: sprite fill participates in the same transform/animation stage.
  vec4 transformed = applyTransform(color, v_colorXform.y, v_colorXform.z, v_colorXform.x, v_colorXform.w);
  return applyColorAnimation(transformed);
}

void main() {
  float fillType = v_fillInfo.x;
  vec4 color = v_stopColor0;

  // Sprite texture fill (fillType == 4.0)
  if (fillType >= 3.5 && fillType < 4.5) {
    color = texture(u_spriteTexture, v_uv);
  }

  if (fillType >= 0.5 && fillType < 3.5) {
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

  vec4 transformedColor = applyColorPipeline(color);
  vec4 baseColor = applyFillNoise(applyFillFilaments(transformedColor));
  float crackStrength = v_crackMask.z;
  float crackAtlasId = v_crackMask.y;

  if (crackStrength <= 0.0 || abs(crackAtlasId - float(u_crackAtlasIndex)) > 0.5) {
    fragColor = baseColor;
    return;
  }

  float cols = max(u_crackAtlasGrid.x, 1.0);
  float rows = max(u_crackAtlasGrid.y, 1.0);
  float idx = v_crackMask.x;
  // Apply tiling: fract() wraps UV coordinates for seamless repetition
  vec2 baseUV = fract(v_crackUv);
  vec2 tileScale = vec2(1.0 / cols, 1.0 / rows);
  vec2 tileOffset = vec2(mod(idx, cols), floor(idx / cols)) * tileScale;
  vec2 atlasUV = tileOffset + baseUV * tileScale;
  
  // Sample alpha channel as crack mask (black cracks on transparent background)
  float crackMask = texture(u_cracksAtlas, atlasUV).a;
  float desat = v_crackEffects.x;
  float darken = v_crackEffects.y;

  float k = crackMask * crackStrength;
  if (k <= 0.0) {
    fragColor = baseColor;
    return;
  }

  vec3 base = baseColor.rgb;

  float grayLuma = dot(base, vec3(0.3, 0.3, 0.3));
  vec3 gray = vec3(grayLuma);

  vec3 saturated = gray + (base - gray) * desat;

  saturated = clamp(saturated, 0.0, 1.0);

  vec3 darkened = saturated * darken;

  vec3 finalRgb = mix(base, darkened, k);

  fragColor = vec4(finalRgb, baseColor.a);
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
