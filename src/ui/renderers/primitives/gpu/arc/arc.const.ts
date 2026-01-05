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
uniform float u_oscAmplitude;
uniform float u_oscAngularSpeed;

out vec4 fragColor;

` + CLAMP01_GLSL + `

// Optimized noise function - reduced complexity but keeps visual quality
float noise1(float t){
  return sin(t) * 0.7 + sin(t*1.7+1.3)*0.3;
}

void main(){
  float len = max(v_length, 0.0001);
  vec2 rel = v_worldPos - v_from;
  float proj = dot(rel, v_axis);
  float t = clamp(proj / len, 0.0, 1.0);
  float baseOffset = dot(rel, v_normal);

  float phase = t * v_noisePhaseScale;
  float timeOsc = u_oscAngularSpeed * v_age;
  float n = noise1(phase + timeOsc) * u_noiseAmplitude * (1.0 + u_oscAmplitude * 0.5);
  float dist = abs(baseOffset - n);

  float taperFrac = 0.2;
  float endIn  = smoothstep(0.0, taperFrac, t);
  float endOut = smoothstep(0.0, taperFrac, 1.0 - t);
  float endTaper = endIn * endOut;

  float shortScale = v_shortScale;
  float core = (u_coreWidth * 0.5) * max(0.0, endTaper) * shortScale;
  float blur = u_blurWidth * max(0.0, endTaper) * shortScale;
  float safeBlur = max(blur, 0.0001);

  float blend = clamp01((dist - core) / safeBlur);
  float inside = 1.0 - step(core, dist);
  float coreBlend = mix(1.0 - blend, 1.0, inside);

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

  vec3 rgb = mix(u_blurColor.rgb, u_coreColor.rgb, coreBlend);
  float a = mix(u_blurColor.a, u_coreColor.a, coreBlend);
  float finalAlpha = a * coreBlend * fade;

  fragColor = vec4(rgb, finalAlpha);
  if (fragColor.a <= 0.001) discard;
}
`;
