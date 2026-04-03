import { TO_CLIP_GLSL, CLAMP01_GLSL } from "../../../shaders/common.glsl";

// Instance data: from(2), to(2), age(1), lifetime(1)
export const INSTANCE_COMPONENTS = 6;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 512;

export const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPos; // quad: [-0.5..0.5]x[-0.5..0.5]
in vec2 a_from;
in vec2 a_to;
in float a_age;
in float a_lifetime;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_noiseAmplitude;
uniform float u_noiseDensity;
uniform float u_oscAmplitude;

out vec2 v_worldPos;
flat out vec2 v_from;
flat out float v_age;
flat out float v_lifetime;
flat out vec2 v_axis;
flat out vec2 v_normal;
flat out float v_length;
flat out float v_noisePhaseScale;
flat out float v_shortScale;

` + TO_CLIP_GLSL + `

void main() {
  v_from = a_from;
  v_age = a_age;
  v_lifetime = a_lifetime;
  float noiseReach = u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float halfWidth = 0.5 * u_coreWidth + u_blurWidth + noiseReach;

  // Build a bounding quad around the segment
  vec2 dir = a_to - a_from;
  float len = max(length(dir), 0.0001);
  vec2 axis = dir / len;
  vec2 normal = vec2(-axis.y, axis.x);
  float nominal = max(u_coreWidth + 2.0 * u_blurWidth, 0.0001);
  v_axis = axis;
  v_normal = normal;
  v_length = len;
  v_noisePhaseScale = len * u_noiseDensity * 3.14159265359; // 0.5 * TAU
  v_shortScale = clamp(len / nominal, 0.35, 1.0);

  // a_unitPos.x in [-0.5,0.5] maps along axis from center; a_unitPos.y scales normal
  vec2 center = (a_from + a_to) * 0.5;
  float along = a_unitPos.x * len;
  float side = a_unitPos.y * halfWidth * 2.0; // full height quad
  vec2 world = center + axis * along + normal * side;

  v_worldPos = world;
  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

export const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_worldPos;
flat in vec2 v_from;
flat in float v_age;
flat in float v_lifetime;
flat in vec2 v_axis;
flat in vec2 v_normal;
flat in float v_length;
flat in float v_noisePhaseScale;
flat in float v_shortScale;

uniform vec4 u_coreColor;
uniform vec4 u_blurColor;
uniform float u_coreWidth;
uniform float u_blurWidth;
uniform float u_fadeStartMs;
uniform float u_noiseAmplitude;
uniform float u_aperiodicStrength;
uniform float u_kinkAmplitude;
uniform float u_kinkFrequency;
uniform float u_oscAmplitude;
uniform float u_oscAngularSpeed;
uniform float u_edgeRoughness;
uniform float u_edgeNoiseFreq;
uniform float u_edgeNoiseFreqCross;
uniform float u_strandDensity;
uniform float u_strandSharpness;
uniform float u_strandJitter;
uniform float u_glowBreakup;
uniform float u_glowBreakupFreq;
uniform float u_turbulenceSpeed;

out vec4 fragColor;

` + CLAMP01_GLSL + `

// Optimized noise function - reduced complexity but keeps visual quality
float noise1(float t){
  return sin(t) * 0.7 + sin(t*1.7+1.3)*0.3;
}

float hash1(float x) {
  return fract(sin(x) * 43758.5453);
}

float valueNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float a = hash1(i);
  float b = hash1(i + 1.0);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u) * 2.0 - 1.0;
}

float tri(float x) {
  return abs(fract(x) - 0.5) * 2.0 - 0.5;
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

float fbm2D(vec2 p) {
  return valueNoise2D(p) * 0.5
       + valueNoise2D(p * 2.7 + vec2(7.0, 3.0)) * 0.3
       + valueNoise2D(p * 6.3 + vec2(13.0, 11.0)) * 0.2;
}

void main(){
  float len = max(v_length, 0.0001);
  vec2 rel = v_worldPos - v_from;
  float proj = dot(rel, v_axis);
  float t = clamp(proj / len, 0.0, 1.0);
  float baseOffset = dot(rel, v_normal);

  float phase = t * v_noisePhaseScale;
  float timeOsc = u_oscAngularSpeed * v_age;
  float seed = hash1(dot(v_from, vec2(12.9898, 78.233)) + dot(v_axis, vec2(39.346, 11.135)));
  float periodic = noise1(phase + timeOsc);
  float aperiodic = valueNoise(phase + timeOsc * 0.37 + seed * 12.0);
  float mixedNoise = mix(periodic, aperiodic, u_aperiodicStrength);
  float n = mixedNoise * u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float kink = tri(phase * u_kinkFrequency + seed) * u_kinkAmplitude;
  float dist = abs(baseOffset - n - kink);

  float taperFrac = 0.2;
  float endIn  = smoothstep(0.0, taperFrac, t);
  float endOut = smoothstep(0.0, taperFrac, 1.0 - t);
  float endTaper = endIn * endOut;

  float shortScale = v_shortScale;
  float core = (u_coreWidth * 0.5) * max(0.0, endTaper) * shortScale;
  float blur = u_blurWidth * max(0.0, endTaper) * shortScale;
  float safeBlur = max(blur, 0.0001);

  // Edge roughness — 2D turbulence for organic boundaries + core bleed
  float edgeDist = dist;
  float turb = 0.0;
  if (u_edgeRoughness > 0.0) {
    float turbTime = v_age * u_turbulenceSpeed * 0.001;
    float beamWidth = max(core + blur, 0.001);
    vec2 turbUV = vec2(
      t * u_edgeNoiseFreq + turbTime * 0.5 + seed * 5.0,
      baseOffset / beamWidth * u_edgeNoiseFreqCross + seed * 3.0
    );
    turb = fbm2D(turbUV + vec2(turbTime * 0.7, turbTime * 0.3));
    edgeDist = max(0.0, dist + turb * u_edgeRoughness * core * 2.5);
  }

  // Time-based fade
  float fade = 1.0;
  if (u_fadeStartMs < v_lifetime) {
    if (v_age > u_fadeStartMs) {
      float fdur = max(1.0, v_lifetime - u_fadeStartMs);
      float fprog = clamp01((v_age - u_fadeStartMs) / fdur);
      fade = 1.0 - fprog;
    }
  }

  // Discard inactive/cleared instances
  if (v_lifetime <= 0.0) discard;

  // Glow: smooth falloff, unaffected by turbulence
  float glowFalloff = 1.0 - smoothstep(core, core + safeBlur, dist);
  
  // Core: uses edgeDist — turbulence displaces the boundary
  float coreTransition = core * mix(0.2, 0.5, u_edgeRoughness);
  float coreFalloff = 1.0 - smoothstep(core - coreTransition, core, edgeDist);

  // Strands — fibrous pattern across beam width
  if (u_strandDensity > 0.0) {
    float turbTime = v_age * u_turbulenceSpeed * 0.001;
    float normOff = baseOffset / max(core + blur, 0.001);
    float jitter = valueNoise(t * 12.0 + seed * 3.0 + turbTime * 2.0) * u_strandJitter;
    float strandPhase = (normOff + jitter) * u_strandDensity * 3.14159;
    float strandMask = pow(abs(sin(strandPhase)), u_strandSharpness);
    coreFalloff *= mix(0.3, 1.0, strandMask);
    glowFalloff *= mix(0.5, 1.0, strandMask * 0.7);
  }

  // Glow breakup — 2D wisps in the outer aura
  if (u_glowBreakup > 0.0) {
    float turbTime = v_age * u_turbulenceSpeed * 0.001;
    float beamWidth = max(core + blur, 0.001);
    vec2 wispUV = vec2(
      t * u_glowBreakupFreq + turbTime * 0.4 + seed * 7.0,
      baseOffset / beamWidth * 3.0
    );
    float wispTurb = fbm2D(wispUV);
    float wispMask = smoothstep(-0.2, 0.5, wispTurb);
    glowFalloff *= mix(1.0, wispMask, u_glowBreakup * (1.0 - coreFalloff));
  }

  // Blend: core over glow
  vec3 rgb = mix(u_blurColor.rgb, u_coreColor.rgb, coreFalloff);
  float alpha = mix(u_blurColor.a * glowFalloff, u_coreColor.a, coreFalloff);
  
  float finalAlpha = alpha * fade;

  fragColor = vec4(rgb, finalAlpha);
  if (fragColor.a <= 0.001) discard;
}
`;
