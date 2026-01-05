import { TO_CLIP_GLSL, CLAMP01_GLSL } from "../../../shaders/common.glsl";

// Instance data: center(2), radius(1), phase(1), intensity(1), active(1),
// rotationSpeedMultiplier(1), spiralArms(1), spiralArms2(1), spiralTwist(1), spiralTwist2(1),
// colorInner(3), colorMid(3), colorOuter(3)
export const INSTANCE_COMPONENTS = 20;
export const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const DEFAULT_BATCH_CAPACITY = 512;

export const WHIRL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_center;
in float a_radius;
in float a_phase;
in float a_intensity;
in float a_active;
in float a_rotationSpeedMultiplier;
in float a_spiralArms;
in float a_spiralArms2;
in float a_spiralTwist;
in float a_spiralTwist2;
in vec3 a_colorInner;
in vec3 a_colorMid;
in vec3 a_colorOuter;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time;

out vec2 v_localPosition;
out float v_radius;
out float v_phase;
out float v_intensity;
out float v_time;
out float v_rotationSpeedMultiplier;
out float v_spiralArms;
out float v_spiralArms2;
out float v_spiralTwist;
out float v_spiralTwist2;
out vec3 v_colorInner;
out vec3 v_colorMid;
out vec3 v_colorOuter;

` + TO_CLIP_GLSL + `

void main() {
  if (a_active < 0.5) {
    v_localPosition = vec2(0.0);
    v_radius = 0.0;
    v_phase = 0.0;
    v_intensity = 0.0;
    v_time = u_time;
    v_rotationSpeedMultiplier = 1.0;
    v_spiralArms = 6.0;
    v_spiralArms2 = 12.0;
    v_spiralTwist = 7.0;
    v_spiralTwist2 = 4.0;
    v_colorInner = vec3(0.95, 0.88, 0.72);
    v_colorMid = vec3(0.85, 0.72, 0.58);
    v_colorOuter = vec3(0.68, 0.55, 0.43);
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float radius = max(a_radius, 0.0001);
  float diameter = radius * 2.0;
  vec2 offset = a_unitPosition * diameter;
  vec2 world = a_center + offset;

  v_localPosition = offset;
  v_radius = radius;
  v_phase = a_phase;
  v_intensity = max(a_intensity, 0.0);
  v_time = u_time;
  v_rotationSpeedMultiplier = max(a_rotationSpeedMultiplier, 0.0);
  v_spiralArms = max(a_spiralArms, 1.0);
  v_spiralArms2 = max(a_spiralArms2, 1.0);
  v_spiralTwist = a_spiralTwist;
  v_spiralTwist2 = a_spiralTwist2;
  v_colorInner = max(a_colorInner, vec3(0.0));
  v_colorMid = max(a_colorMid, vec3(0.0));
  v_colorOuter = max(a_colorOuter, vec3(0.0));

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

export const WHIRL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPosition;
in float v_radius;
in float v_phase;
in float v_intensity;
in float v_time;
in float v_rotationSpeedMultiplier;
in float v_spiralArms;
in float v_spiralArms2;
in float v_spiralTwist;
in float v_spiralTwist2;
in vec3 v_colorInner;
in vec3 v_colorMid;
in vec3 v_colorOuter;

out vec4 fragColor;

` + CLAMP01_GLSL + `

void main() {
  float radius = max(v_radius, 0.0001);
  vec2 normalized = v_localPosition / radius;
  float distance = length(normalized);
  if (distance > 1.2) {
    fragColor = vec4(0.0);
    return;
  }

  float falloff = smoothstep(1.2, 0.0, distance);
  float angle = atan(normalized.y, normalized.x);
  float time = v_time * 0.0025 * v_rotationSpeedMultiplier;
  
  // Spiral arms - основні спіральні лінії
  float spiralTwist = -distance * v_spiralTwist + time * 16.0 + v_phase * 0.7;
  float spiral = sin(angle * v_spiralArms + spiralTwist);
  float spiralSharp = smoothstep(0.4, 0.7, spiral);
  
  // Додаткові спіралі для деталей
  float spiralTwist2 = -distance * v_spiralTwist2 + time * 12.0 + v_phase;
  float spiral2 = cos(angle * v_spiralArms2 + spiralTwist2);
  float spiralSharp2 = smoothstep(0.3, 0.65, spiral2) * 0.4;
  
  // Радіальні смуги для глибини
  float radialBands = sin(distance * 8.0 - time * 4.0) * 0.3 + 0.7;
  
  // Комбінуємо ефекти
  float whirlPattern = mix(spiralSharp, spiralSharp2, 0.3);
  whirlPattern = mix(whirlPattern, radialBands, 0.25);
  
  // Центр вихору - яскравіший
  float centerBoost = smoothstep(0.6, 0.0, distance);
  whirlPattern = mix(whirlPattern, 1.0, centerBoost * 0.4);
  
  float alpha = clamp01((0.5 + 0.5 * whirlPattern) * falloff * max(v_intensity, 0.0));

  // Міксуємо кольори залежно від відстані та паттерну
  float distMix = clamp01(distance * 1.2);
  vec3 baseColor = mix(v_colorInner, v_colorMid, distMix * 0.6);
  baseColor = mix(baseColor, v_colorOuter, distMix);
  
  // Підсвічуємо спіральні лінії
  vec3 color = mix(baseColor, v_colorInner, spiralSharp * 0.3);

  fragColor = vec4(color, alpha);
}
`;
