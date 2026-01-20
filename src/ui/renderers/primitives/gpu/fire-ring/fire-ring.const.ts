import { TO_CLIP_GLSL } from "../../../shaders/common.glsl";

const FIRE_RING_EXTRA_RADIUS = 160.0;

// center(2) + inner(1) + outer(1) + birth(1) + lifetime(1) + intensity(1) + active(1) + color(3)
export const INSTANCE_COMPONENTS = 11;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 512;

export const FIRE_RING_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2  a_unitPosition;   // quad [-1,-1]..[1,1]
in vec2  a_center;
in float a_innerRadius;
in float a_outerRadius;
in float a_birthTimeMs;    // <-- NEW: time of spawn in ms
in float a_lifetime;       // ms (<=0 => infinite)
in float a_intensity;
in vec3  a_color;
in float a_active;

uniform vec2  u_cameraPosition;
uniform vec2  u_viewportSize;
uniform float u_time;      // ms

out vec2  v_localPosition;
out float v_innerRadius;
out float v_outerRadius;
out float v_birthTimeMs;
out float v_lifetime;
out float v_intensity;
out vec3  v_color;
out float v_time;

` + TO_CLIP_GLSL + `

void main() {
  if (a_active < 0.5) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float maxRadius = a_outerRadius + 220.0; // extra space for tongues
  vec2 offset   = a_unitPosition * maxRadius;
  vec2 worldPos = a_center + offset;

  v_localPosition = offset;
  v_innerRadius   = a_innerRadius;
  v_outerRadius   = a_outerRadius;
  v_birthTimeMs   = a_birthTimeMs;
  v_lifetime      = a_lifetime;
  v_intensity     = a_intensity;
  v_color         = a_color;
  v_time          = u_time;

  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
}
`;

export const FIRE_RING_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2  v_localPosition;
in float v_innerRadius;
in float v_outerRadius;
in float v_birthTimeMs;
in float v_lifetime;
in float v_intensity;
in vec3  v_color;
in float v_time;

out vec4 fragColor;

// --------- noise utils ----------
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return v;
}

// --------- tunables ----------
const float INNER_SOFT   = 6.0;
const float OUTER_SOFT   = 6.0;
const float TONGUE_BASE  = 60.0;
const float TONGUE_NOISE = 50.0;
const float UPFLOW       = 0.6;   // upward drift
const float TWIST        = 0.25;  // tiny swirl

// --------- palette ----------
vec3 fireCore()  { return vec3(1.00, 0.95, 0.70); }
vec3 fireHot()   { return vec3(1.00, 0.70, 0.20); }
vec3 fireWarm()  { return vec3(0.95, 0.45, 0.12); }
vec3 fireCool()  { return vec3(0.70, 0.18, 0.06); }

void main() {
  float dist  = length(v_localPosition);
  float timeS = v_time * 0.001;

  // Age on GPU (ms)
  float age = max(v_time - v_birthTimeMs, 0.0);

  // Expiration check (optional early kill)
  if (v_lifetime > 0.0 && age > v_lifetime + 500.0) { // grace 0.5s to avoid popping
    discard;
  }

  if (dist > v_outerRadius + 270.0) discard;

  // 1) soft ring = difference of circles
  float innerStep = 1.0 - smoothstep(v_innerRadius - INNER_SOFT, v_innerRadius + INNER_SOFT, dist);
  float outerStep =      smoothstep(v_outerRadius - OUTER_SOFT, v_outerRadius + OUTER_SOFT, dist);
  float ringMask  = clamp(innerStep * outerStep, 0.0, 1.0);

  // 2) domain warp (no angular spokes)
  vec2 uv = v_localPosition * 0.04;

  vec2 warpA = vec2(
    fbm(uv + vec2( 0.50 * timeS,  0.30 * timeS)),
    fbm(uv + vec2(-0.35 * timeS,  0.55 * timeS))
  );
  vec2 warpB = vec2(
    fbm(uv * 1.8 + vec2( 0.15 * timeS, -0.45 * timeS)),
    fbm(uv * 1.6 + vec2(-0.60 * timeS,  0.20 * timeS))
  );

  vec2 flowDir = normalize(v_localPosition + vec2(1e-6)) * TWIST;
  vec2 warped = uv
              + (warpA - 0.5) * 1.20
              + (warpB - 0.5) * 0.65
              + vec2(0.0, -UPFLOW * timeS)
              + flowDir;

  float turb = fbm(warped);

  // 3) tongues above outer radius
  float above = max(dist - v_outerRadius, 0.0);
  float flameH = TONGUE_BASE + TONGUE_NOISE * turb;
  float tongues = 1.0 - smoothstep(0.0, max(flameH, 1.0), above);
  float edge = 0.80 + 0.20 * fbm(warped * 2.3 + vec2(-0.2 * timeS, 0.35 * timeS));
  tongues *= edge;

  float flameMask = clamp(ringMask + tongues, 0.0, 1.0);
  if (flameMask < 0.01) discard;

  // 4) color
  float ringProgress = clamp((dist - v_innerRadius) / max(v_outerRadius - v_innerRadius, 1.0), 0.0, 1.0);
  vec3 base = mix(fireCore(), fireHot(), ringProgress);
  base = mix(base, fireWarm(), smoothstep(0.4, 1.0, ringProgress));
  if (above > 0.0) {
    float tip = clamp(above / max(flameH, 1.0), 0.0, 1.0);
    base = mix(base, fireCool(), tip);
  }
  vec3 color = mix(base * 0.92, base * 1.08, turb);

  vec3 tint = clamp(v_color, 0.0, 4.0);
  float luminance = max(0.0001, dot(color, vec3(0.299, 0.587, 0.114)));
  vec3 tintDir = normalize(tint + vec3(1e-6));
  vec3 tintTarget = tintDir * luminance * 1.35;
  color = mix(color, tintTarget, 0.65);
  color = mix(color, tint, 0.25);

  // 5) alpha: flicker + GPU life fade (safe)
  float flicker = 0.86 + 0.14 * fbm(warped * 1.6 + vec2(0.5 * timeS, 0.9 * timeS));

  float lifeFade = 1.0;
  if (v_lifetime > 0.0) {
    float fin  = min(v_lifetime * 0.10, 200.0);
    float fout = min(v_lifetime * 0.20, 300.0);

    float fadeIn  = (fin  > 0.0) ? smoothstep(0.0, fin, age) : 1.0;
    float outStart = max(0.0, v_lifetime - fout);
    float fadeOut = (fout > 0.0) ? (1.0 - smoothstep(outStart, v_lifetime, age)) : 1.0;

    lifeFade = clamp(min(fadeIn, fadeOut), 0.0, 1.0);
  }

  float alpha = flameMask * v_intensity * flicker * lifeFade;

  fragColor = vec4(color, alpha);
}
`;
