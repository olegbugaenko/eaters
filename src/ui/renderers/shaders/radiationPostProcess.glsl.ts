export const RADIATION_POST_PROCESS_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_uv;

out vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const RADIATION_POST_PROCESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_sceneTexture;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_resolution;
uniform float u_waveAmplitude;
uniform float u_waveFrequency;
uniform float u_waveSpeed;
uniform float u_jitterStrength;
uniform float u_jitterFrequency;
uniform float u_bandSpeed;
uniform float u_bandWidth;
uniform float u_bandIntensity;

out vec4 fragColor;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  float intensity = clamp(u_intensity, 0.0, 1.0);
  vec2 uv = v_uv;

  float wave = sin(uv.y * u_waveFrequency + u_time * u_waveSpeed);
  float waveShift = wave * u_waveAmplitude * intensity / max(u_resolution.x, 1.0);

  float line = floor(uv.y * u_jitterFrequency);
  float jitterSeed = line + floor(u_time * 60.0);
  float jitter = (hash(jitterSeed) - 0.5) * 2.0;
  float jitterShift = jitter * u_jitterStrength * intensity / max(u_resolution.x, 1.0);

  uv.x += waveShift + jitterShift;
  uv = clamp(uv, vec2(0.0), vec2(1.0));

  vec4 color = texture(u_sceneTexture, uv);

  float bandPos = fract(u_time * u_bandSpeed);
  float bandDist = abs(uv.y - bandPos);
  float band = smoothstep(u_bandWidth, 0.0, bandDist);
  float bandGlow = band * u_bandIntensity * intensity;
  color.rgb += bandGlow;

  fragColor = color;
}
`;
