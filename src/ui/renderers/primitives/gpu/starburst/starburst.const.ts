import type { StarburstInstance } from "./starburst.types";

export const INSTANCE_COMPONENTS = 20;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 256;
export const MAX_SPIKES = 64;

export const UNIT_QUAD_VERTICES = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
]);

export const serializeStarburstConfig = (_config: void): string => "starburst";

export const sanitizeSpikeCount = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_SPIKES, Math.round(value)));
};

/*
 * Instance buffer layout (20 floats per instance):
 *   0-1   position        → a_position (vec2)
 *   2-5   age, lifetime, isActive, spikeCount → a_timeActive (vec4)
 *   6-9   spikeLength, spikeWidth, angleJitterRad, lengthJitter → a_spikeGeom (vec4)
 *  10-13  widthJitter, growSizeMult, fadeStartMs, seed → a_jitterGrow (vec4)
 *  14-15  edgeSoftness, rotationRadPerSec → a_softRot (vec2)
 *  16-19  color → a_color (vec4)
 */

export const STARBURST_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_unitPosition;
in vec2 a_position;
in vec4 a_timeActive;     // age, lifetime, isActive, spikeCount
in vec4 a_spikeGeom;      // spikeLength, spikeWidth, angleJitterRad, lengthJitter
in vec4 a_jitterGrow;     // widthJitter, growSizeMult, fadeStartMs, seed
in vec2 a_softRot;        // edgeSoftness, rotationRadPerSec
in vec4 a_color;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;

out vec2 v_localPosition;
out float v_age;
out float v_lifetime;
out float v_isActive;
out float v_spikeCount;
out float v_spikeLength;
out float v_spikeWidth;
out float v_angleJitterRad;
out float v_lengthJitter;
out float v_widthJitter;
out float v_fadeStartMs;
out float v_seed;
out float v_edgeSoftness;
out float v_rotationRadPerSec;
out vec4 v_color;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  float age = a_timeActive.x;
  float lifetime = max(a_timeActive.y, 1.0);
  bool isAlive = a_timeActive.z > 0.5;
  float spikeLength = a_spikeGeom.x;
  float growSizeMult = a_jitterGrow.y;
  float edgeSoftness = clamp(a_softRot.x, 0.0, 1.0);
  float lengthJitter = a_spikeGeom.w;

  float ageSeconds = max(age, 0.0) * 0.001;
  float growth = growSizeMult > 0.0 ? pow(growSizeMult, ageSeconds) : 1.0;
  float softExtra = 1.0 + edgeSoftness * 1.5;
  float extent = max(spikeLength * (1.0 + abs(lengthJitter)) * growth * softExtra, 1.0);
  vec2 local = a_unitPosition * extent;
  vec2 world = a_position + local;

  v_localPosition = local;
  v_age = age;
  v_lifetime = lifetime;
  v_isActive = a_timeActive.z;
  v_spikeCount = a_timeActive.w;
  v_spikeLength = max(spikeLength * growth, 0.01);
  v_spikeWidth = max(a_spikeGeom.y * growth, 0.01);
  v_angleJitterRad = max(a_spikeGeom.z, 0.0);
  v_lengthJitter = max(lengthJitter, 0.0);
  v_widthJitter = max(a_jitterGrow.x, 0.0);
  v_fadeStartMs = max(a_jitterGrow.z, 0.0);
  v_seed = a_jitterGrow.w;
  v_edgeSoftness = edgeSoftness;
  v_rotationRadPerSec = a_softRot.y;
  v_color = a_color;

  if (!isAlive) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

export const STARBURST_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 v_localPosition;
in float v_age;
in float v_lifetime;
in float v_isActive;
in float v_spikeCount;
in float v_spikeLength;
in float v_spikeWidth;
in float v_angleJitterRad;
in float v_lengthJitter;
in float v_widthJitter;
in float v_fadeStartMs;
in float v_seed;
in float v_edgeSoftness;
in float v_rotationRadPerSec;
in vec4 v_color;

out vec4 fragColor;

const float TWO_PI = 6.28318530718;
const int MAX_SPIKES = ${MAX_SPIKES};

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

float computeFade(float age, float lifetime, float fadeStartMs) {
  if (lifetime <= 0.0) {
    return 0.0;
  }
  if (fadeStartMs <= 0.0 || fadeStartMs >= lifetime) {
    return 1.0 - clamp(age / lifetime, 0.0, 1.0);
  }
  if (age <= fadeStartMs) {
    return 1.0;
  }
  float tail = max(1.0, lifetime - fadeStartMs);
  return 1.0 - clamp((age - fadeStartMs) / tail, 0.0, 1.0);
}

float spikeMaskFor(int i, vec2 p, float spikeCount) {
  float fi = float(i);
  float baseAngle = fi * TWO_PI / max(spikeCount, 1.0);

  float jitterA = (hash11(v_seed + fi * 13.17) * 2.0 - 1.0) * v_angleJitterRad;
  float spikeAngle = baseAngle + jitterA;

  vec2 dir = vec2(cos(spikeAngle), sin(spikeAngle));
  float along = dot(p, dir);
  if (along <= 0.0) {
    return 0.0;
  }

  float lenRand = (hash11(v_seed + fi * 29.31 + 7.0) * 2.0 - 1.0) * v_lengthJitter;
  float widthRand = (hash11(v_seed + fi * 47.77 + 11.0) * 2.0 - 1.0) * v_widthJitter;

  float spikeLen = max(v_spikeLength * (1.0 + lenRand), 0.001);
  float t = clamp(along / spikeLen, 0.0, 1.0);

  float lengthFade = (1.0 - t) * (1.0 - t * 0.5);

  float side = abs(dir.x * p.y - dir.y * p.x);
  float baseHalf = max(v_spikeWidth * (1.0 + widthRand) * 0.5, 0.001);
  float halfWidth = mix(baseHalf, 0.001, t);

  float sigma = halfWidth * (0.4 + v_edgeSoftness * 1.6);
  float lateralMask = exp(-0.5 * (side * side) / max(sigma * sigma, 0.0001));

  return lateralMask * lengthFade;
}

void main() {
  if (v_isActive < 0.5) {
    discard;
  }

  float rotAngle = v_age * v_rotationRadPerSec * 0.001;
  float cosR = cos(rotAngle);
  float sinR = sin(rotAngle);
  vec2 p = vec2(
    v_localPosition.x * cosR + v_localPosition.y * sinR,
    -v_localPosition.x * sinR + v_localPosition.y * cosR
  );

  float spikeCount = clamp(v_spikeCount, 1.0, float(MAX_SPIKES));

  float mask = 0.0;
  for (int i = 0; i < MAX_SPIKES; i++) {
    if (float(i) >= spikeCount) {
      break;
    }
    mask = max(mask, spikeMaskFor(i, p, spikeCount));
  }

  float coreRadius = v_spikeWidth * (0.4 + v_edgeSoftness * 0.6);
  float dist = length(p);
  float coreMask = exp(-0.5 * (dist * dist) / max(coreRadius * coreRadius, 0.01));
  mask = max(mask, coreMask);

  float fade = computeFade(v_age, max(v_lifetime, 1.0), v_fadeStartMs);
  float alpha = v_color.a * mask * fade;
  if (alpha <= 0.001) {
    discard;
  }

  fragColor = vec4(v_color.rgb, alpha);
}
`;

export const writeStarburstInstanceData = (
  target: Float32Array,
  offset: number,
  instance: StarburstInstance
): void => {
  target[offset + 0] = instance.position.x;
  target[offset + 1] = instance.position.y;
  target[offset + 2] = Math.max(0, instance.age);
  target[offset + 3] = Math.max(1, instance.lifetime);
  target[offset + 4] = instance.active ? 1 : 0;
  target[offset + 5] = sanitizeSpikeCount(instance.spikeCount);
  target[offset + 6] = Math.max(0.01, instance.spikeLength);
  target[offset + 7] = Math.max(0.01, instance.spikeWidth);
  target[offset + 8] = Math.max(0, instance.angleJitterRad);
  target[offset + 9] = Math.max(0, instance.lengthJitter);
  target[offset + 10] = Math.max(0, instance.widthJitter);
  target[offset + 11] = Math.max(0.0001, instance.growSizeMult);
  target[offset + 12] = Math.max(0, instance.fadeStartMs);
  target[offset + 13] = instance.seed;
  target[offset + 14] = Math.max(0, instance.edgeSoftness);
  target[offset + 15] = instance.rotationRadPerSec;
  target[offset + 16] = instance.color.r;
  target[offset + 17] = instance.color.g;
  target[offset + 18] = instance.color.b;
  target[offset + 19] = instance.color.a ?? 1;
};
