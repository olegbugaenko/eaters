/**
 * GPU Ring Trail Shaders
 * Renders animated expanding rings with radial gradient fading
 */

export const RING_VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex attributes (unit circle)
in vec2 a_position;

// Per-instance attributes
in vec2 a_instancePosition;    // World position
in float a_instanceCreatedAt;  // Creation time in ms
in float a_instanceLifetime;   // Lifetime in ms
in float a_instanceStartRadius;
in float a_instanceEndRadius;
in float a_instanceStartAlpha;
in float a_instanceEndAlpha;
in float a_instanceInnerStop;
in float a_instanceOuterStop;
in vec3 a_instanceColor;
in float a_instanceActive;     // 1.0 = active, 0.0 = inactive

// Uniforms
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time; // Current time in ms

// Outputs to fragment shader
out vec2 v_localPos;      // Position in local ring space [-1, 1]
out float v_progress;     // Animation progress [0, 1]
out float v_startAlpha;
out float v_endAlpha;
out float v_innerStop;
out float v_outerStop;
out vec3 v_color;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  // Discard inactive instances
  if (a_instanceActive < 0.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0); // Off-screen
    return;
  }

  // Calculate animation progress
  float elapsed = u_time - a_instanceCreatedAt;
  float progress = clamp(elapsed / max(a_instanceLifetime, 1.0), 0.0, 1.0);
  
  // Interpolate radius based on progress
  float radius = mix(a_instanceStartRadius, a_instanceEndRadius, progress);
  
  // Scale unit circle by current radius
  vec2 worldPos = a_instancePosition + a_position * radius;
  
  // Convert to clip space (same formula as PetalAuraGpuRenderer)
  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  
  // Pass to fragment shader
  v_localPos = a_position; // Already in [-1, 1] range
  v_progress = progress;
  v_startAlpha = a_instanceStartAlpha;
  v_endAlpha = a_instanceEndAlpha;
  v_innerStop = a_instanceInnerStop;
  v_outerStop = a_instanceOuterStop;
  v_color = a_instanceColor;
}
`;

export const RING_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPos;
in float v_progress;
in float v_startAlpha;
in float v_endAlpha;
in float v_innerStop;
in float v_outerStop;
in vec3 v_color;

out vec4 fragColor;

void main() {
  // Distance from center in [0, 1] range
  float dist = length(v_localPos);
  
  // Discard outside unit circle
  if (dist > 1.0) {
    discard;
  }
  
  // Interpolate alpha based on progress
  float baseAlpha = mix(v_startAlpha, v_endAlpha, v_progress);
  
  // Radial gradient: transparent at center, opaque ring, fade to transparent at edge
  float outerFadeStop = min(1.0, v_outerStop + 0.15);
  
  float alpha = 0.0;
  if (dist < v_innerStop) {
    alpha = 0.0;
  } else if (dist < v_outerStop) {
    // Fade in from inner to outer
    alpha = smoothstep(v_innerStop, v_outerStop, dist) * baseAlpha;
  } else if (dist < outerFadeStop) {
    // Fade out from outer to edge
    alpha = (1.0 - smoothstep(v_outerStop, outerFadeStop, dist)) * baseAlpha;
  } else {
    alpha = 0.0;
  }
  
  fragColor = vec4(v_color, alpha);
}
`;

