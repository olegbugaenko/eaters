import type { StarburstInstance } from "./starburst.types";

export const INSTANCE_COMPONENTS = 18;
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

export const STARBURST_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_unitPosition;
in vec2 a_position;
in float a_age;
in float a_lifetime;
in float a_isActive;
in float a_spikeCount;
in float a_spikeLength;
in float a_spikeWidth;
in float a_angleJitterRad;
in float a_lengthJitter;
in float a_widthJitter;
in float a_growSizeMult;
in float a_fadeStartMs;
in float a_seed;
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
out vec4 v_color;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  bool active = a_isActive > 0.5;
  float lifetime = max(a_lifetime, 1.0);
  float ageSeconds = max(a_age, 0.0) * 0.001;
  float growth = a_growSizeMult > 0.0 ? pow(a_growSizeMult, ageSeconds) : 1.0;
  float extent = max(a_spikeLength * (1.0 + abs(a_lengthJitter)) * growth, 1.0);
  vec2 local = a_unitPosition * extent;
  vec2 world = a_position + local;

  v_localPosition = local;
  v_age = a_age;
  v_lifetime = lifetime;
  v_isActive = a_isActive;
  v_spikeCount = a_spikeCount;
  v_spikeLength = max(a_spikeLength * growth, 0.01);
  v_spikeWidth = max(a_spikeWidth * growth, 0.01);
  v_angleJitterRad = max(a_angleJitterRad, 0.0);
  v_lengthJitter = max(a_lengthJitter, 0.0);
  v_widthJitter = max(a_widthJitter, 0.0);
  v_fadeStartMs = max(a_fadeStartMs, 0.0);
  v_seed = a_seed;
  v_color = a_color;

  if (!active) {
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
in vec4 v_color;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const int MAX_SPIKES = ${MAX_SPIKES};

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

float periodicAngleDiff(float a, float b) {
  float d = abs(a - b);
  return min(d, TWO_PI - d);
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

float spikeMaskFor(int i, vec2 p, float radius, float spikeCount) {
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
  if (along > spikeLen) {
    return 0.0;
  }

  float side = abs(dir.x * p.y - dir.y * p.x);
  float t = clamp(along / spikeLen, 0.0, 1.0);
  float baseHalf = max(v_spikeWidth * (1.0 + widthRand) * 0.5, 0.001);
  float halfWidth = mix(baseHalf, 0.0, t);
  float feather = max(radius * 0.008, 0.25);

  return 1.0 - smoothstep(halfWidth, halfWidth + feather, side);
}

void main() {
  if (v_isActive < 0.5) {
    discard;
  }

  vec2 p = v_localPosition;
  float radius = length(p);
  float spikeCount = clamp(v_spikeCount, 1.0, float(MAX_SPIKES));

  float mask = 0.0;
  for (int i = 0; i < MAX_SPIKES; i++) {
    if (float(i) >= spikeCount) {
      break;
    }
    mask = max(mask, spikeMaskFor(i, p, radius, spikeCount));
  }

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
  target[offset + 14] = instance.color.r;
  target[offset + 15] = instance.color.g;
  target[offset + 16] = instance.color.b;
  target[offset + 17] = instance.color.a ?? 1;
};
