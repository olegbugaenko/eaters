import {
  CORE_NOISE_GLSL,
  APPLY_FILL_NOISE_GLSL,
  APPLY_FILL_FILAMENTS_GLSL,
  DEFAULT_NOISE_ANCHOR,
  createNoiseAnchorGLSL,
} from "../../../shaders/fillEffects.glsl";
import { TO_CLIP_GLSL, CLAMP01_GLSL } from "../../../shaders/common.glsl";

export const UNIT_QUAD_VERTICES = new Float32Array([
  // TRIANGLE_STRIP order: bottom-left, bottom-right, top-left, top-right
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);

export const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_unitPosition;
in vec2 a_position;
in float a_size;
in float a_age;
in float a_lifetime;
in float a_isActive;
in vec2 a_velocity;
in float a_startAlpha;
in float a_endAlpha;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_fadeStartMs;
uniform float u_defaultLifetimeMs;
uniform float u_minParticleSize;
uniform float u_lengthMultiplier;
uniform int u_alignToVelocity;
uniform int u_alignToVelocityFlip;
uniform float u_sizeGrowthRate;

uniform int u_fillType;
uniform int u_stopCount;
uniform int u_hasLinearStart;
uniform int u_hasLinearEnd;
uniform int u_hasRadialOffset;
uniform int u_hasExplicitRadius;
uniform int u_shape;

uniform vec2 u_linearStart;
uniform vec2 u_linearEnd;
uniform vec2 u_radialOffset;
uniform float u_explicitRadius;

uniform float u_stopOffsets[5];
uniform vec4 u_stopColor0;
uniform vec4 u_stopColor1;
uniform vec4 u_stopColor2;
uniform vec4 u_stopColor3;
uniform vec4 u_stopColor4;
uniform vec2 u_noiseAmplitude;
uniform float u_noiseScale;
uniform float u_noiseDensity;
uniform vec4 u_filaments0;
uniform float u_filamentEdgeBlur;

out vec2 v_worldPosition;
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec4 v_filaments0;
out float v_filamentEdgeBlur;
out float v_stopOffsets[5];
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
out vec4 v_stopColor3;
out vec4 v_stopColor4;
out float v_shape;
out vec2 v_alignDir;
out vec2 v_particleCenter;
out float v_particleRadius;

` + CLAMP01_GLSL + TO_CLIP_GLSL + `

float computeAlpha(float age, float lifetime, float startAlpha, float endAlpha) {
  float effectiveLifetime = lifetime > 0.0 ? lifetime : u_defaultLifetimeMs;
  if (effectiveLifetime <= 0.0) {
    return startAlpha;
  }
  float fadeProgress = clamp01(age / effectiveLifetime);
  return mix(startAlpha, endAlpha, fadeProgress);
}

void main() {
  float isActive = a_isActive;
  bool alive = isActive > 0.5;
  float baseSize = a_size;
  // Apply size growth: size = baseSize * growthRate^(age/1000)
  float ageSeconds = a_age * 0.001;
  float growthMultiplier = u_sizeGrowthRate > 0.0 ? pow(u_sizeGrowthRate, ageSeconds) : 1.0;
  float size = alive ? max(baseSize * growthMultiplier, u_minParticleSize) : 0.0;
  vec2 center = a_position;
  float lengthMul = max(u_lengthMultiplier, 1.0);
  vec2 baseOffset = vec2(a_unitPosition.x * size * lengthMul, a_unitPosition.y * size);
  vec2 world;
  vec2 dir = a_velocity;
  float len = length(dir);
  vec2 ndir = len > 0.0001 ? dir / len : vec2(1.0, 0.0);
  if (u_alignToVelocityFlip == 1) {
    ndir = -ndir;
  }
  if (u_alignToVelocity == 1) {
    vec2 perp = vec2(-ndir.y, ndir.x);
    vec2 rotated = ndir * baseOffset.x + perp * baseOffset.y;
    world = center + rotated;
  } else {
    world = center + baseOffset;
  }

  // Use per-instance alpha range if provided (startAlpha > 0 or endAlpha > 0), otherwise use uniform-based fade
  float startA = a_startAlpha > 0.0 || a_endAlpha > 0.0 ? a_startAlpha : 1.0;
  float endA = a_startAlpha > 0.0 || a_endAlpha > 0.0 ? a_endAlpha : 0.0;
  float alpha = alive ? computeAlpha(a_age, a_lifetime, startA, endA) : 0.0;

  v_worldPosition = world;
  for (int i = 0; i < 5; i++) {
    v_stopOffsets[i] = u_stopOffsets[i];
  }

  vec4 stop0 = u_stopColor0;
  vec4 stop1 = u_stopColor1;
  vec4 stop2 = u_stopColor2;
  vec4 stop3 = u_stopColor3;
  vec4 stop4 = u_stopColor4;
  stop0.a *= alpha;
  stop1.a *= alpha;
  stop2.a *= alpha;
  stop3.a *= alpha;
  stop4.a *= alpha;
  v_stopColor0 = stop0;
  v_stopColor1 = stop1;
  v_stopColor2 = stop2;
  v_stopColor3 = stop3;
  v_stopColor4 = stop4;

  v_fillInfo = vec4(float(u_fillType), float(u_stopCount), u_noiseAmplitude.x, u_noiseAmplitude.y);
  v_filaments0 = u_filaments0;
  v_filamentEdgeBlur = u_filamentEdgeBlur;

  if (u_fillType == 1) {
    vec2 startWorld;
    vec2 endWorld;
    vec2 dir;
    if (u_alignToVelocity == 1) {
      float halfLen = (size * 0.5) * max(u_lengthMultiplier, 1.0);
      vec2 vdir = a_velocity;
      float vlen = length(vdir);
      vec2 ndir = vlen > 0.0001 ? vdir / vlen : vec2(1.0, 0.0);
      startWorld = center - ndir * halfLen;
      endWorld = center + ndir * halfLen;
      dir = endWorld - startWorld;
    } else {
      vec2 startLocal = u_hasLinearStart == 1 ? u_linearStart : vec2(-size * 0.5, 0.0);
      vec2 endLocal = u_hasLinearEnd == 1 ? u_linearEnd : vec2(size * 0.5, 0.0);
      startWorld = center + startLocal;
      endWorld = center + endLocal;
      dir = endWorld - startWorld;
    }
    float lengthSq = dot(dir, dir);
    v_fillParams0 = vec4(startWorld, endWorld);
    v_fillParams1 = vec4(dir, lengthSq > 0.0 ? 1.0 / lengthSq : 0.0, u_noiseScale);
  } else if (u_fillType == 2 || u_fillType == 3) {
    vec2 offsetLocal = u_hasRadialOffset == 1 ? u_radialOffset : vec2(0.0);
    vec2 gradientCenter = center + offsetLocal;
    float radius = u_hasExplicitRadius == 1 ? u_explicitRadius : size * 0.5;
    v_fillParams0 = vec4(gradientCenter, radius, 0.0);
    v_fillParams1 = vec4(0.0, u_noiseDensity, 0.0, u_noiseScale);
  } else {
    v_fillParams0 = vec4(center, 0.0, 0.0);
    v_fillParams1 = vec4(0.0, u_noiseDensity, 0.0, u_noiseScale);
  }

  v_shape = float(u_shape);
  v_alignDir = u_alignToVelocity == 1 ? ndir : vec2(1.0, 0.0);
  v_particleCenter = center;
  v_particleRadius = size * 0.5;

  if (!alive) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_worldPosition;
in vec4 v_fillInfo;
in vec4 v_fillParams0;
in vec4 v_fillParams1;
in vec4 v_filaments0;
in float v_filamentEdgeBlur;
in float v_stopOffsets[5];
in vec4 v_stopColor0;
in vec4 v_stopColor1;
in vec4 v_stopColor2;
in vec4 v_stopColor3;
in vec4 v_stopColor4;
in float v_shape;
in vec2 v_alignDir;
in vec2 v_particleCenter;
in float v_particleRadius;

out vec4 fragColor;

` + CLAMP01_GLSL + CORE_NOISE_GLSL + createNoiseAnchorGLSL(DEFAULT_NOISE_ANCHOR) + APPLY_FILL_NOISE_GLSL + APPLY_FILL_FILAMENTS_GLSL + `

vec4 sampleGradient(float t) {
  int stopCount = int(v_fillInfo.y);
  vec4 colors[5] = vec4[5](v_stopColor0, v_stopColor1, v_stopColor2, v_stopColor3, v_stopColor4);
  
  if (stopCount <= 1) {
    return colors[0];
  }
  
  // Clamp t to valid range
  t = clamp(t, 0.0, 1.0);
  
  // Find the segment t falls into
  for (int i = 0; i < stopCount - 1; i++) {
    float offset0 = v_stopOffsets[i];
    float offset1 = v_stopOffsets[i + 1];
    if (t <= offset1 || i == stopCount - 2) {
      float blend = clamp01((t - offset0) / max(0.00001, offset1 - offset0));
      return mix(colors[i], colors[i + 1], blend);
    }
  }
  
  return colors[stopCount - 1];
}

vec4 shadeSolid() {
  return v_stopColor0;
}

vec4 shadeLinear() {
  vec2 startWorld = v_fillParams0.xy;
  vec2 endWorld = v_fillParams0.zw;
  vec2 dir = v_fillParams1.xy;
  float dirLengthSq = v_fillParams1.z;
  float projection = 0.0;
  if (dirLengthSq > 0.0) {
    projection = clamp01(dot(v_worldPosition - startWorld, dir) * dirLengthSq);
  }
  return sampleGradient(projection);
}

vec4 shadeRadial() {
  vec2 center = v_fillParams0.xy;
  float radius = max(v_fillParams0.z, 0.00001);
  float distance = length(v_worldPosition - center);
  float t = clamp01(distance / radius);
  return sampleGradient(t);
}

void main() {
  if (v_stopColor0.a <= 0.0 && v_stopColor1.a <= 0.0 && v_stopColor2.a <= 0.0 && v_stopColor3.a <= 0.0 && v_stopColor4.a <= 0.0) {
    discard;
  }
  // v_shape: 0.0=square, 1.0=circle, 2.0=triangle
  if (v_shape > 0.5 && v_shape < 1.5) {
    // Circle masking
    float dist = length(v_worldPosition - v_particleCenter);
    if (dist > v_particleRadius) {
      discard;
    }
  } else if (v_shape > 1.5) {
    // Triangle masking: slightly stretched isosceles to avoid "circle" look
    vec2 toCenter = v_worldPosition - v_particleCenter;
    vec2 perp = vec2(-v_alignDir.y, v_alignDir.x);
    vec2 aligned = vec2(dot(toCenter, v_alignDir), dot(toCenter, perp));
    vec2 localPos = aligned / max(v_particleRadius, 0.01);
    float x = localPos.x;
    float absY = abs(localPos.y);
    float baseX = -0.35;
    float tipX = 0.55;
    float baseHalfHeight = 0.35;
    float t = clamp01((x - baseX) / max(tipX - baseX, 0.0001));
    float halfHeight = mix(baseHalfHeight, 0.0, t);
    if (x < baseX || x > tipX || absY > halfHeight) discard;
  }
  float fillType = v_fillInfo.x;
  vec4 color;
  if (fillType < 0.5) {
    color = shadeSolid();
  } else if (abs(fillType - 1.0) < 0.5) {
    color = shadeLinear();
  } else if (abs(fillType - 2.0) < 0.5 || abs(fillType - 3.0) < 0.5) {
    color = shadeRadial();
  } else {
    color = shadeSolid();
  }
  fragColor = applyFillNoise(applyFillFilaments(color));
}
`;
