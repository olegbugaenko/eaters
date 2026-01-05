/**
 * Common GLSL utility functions
 * WebGL 2 (GLSL ES 3.0) syntax
 * Import and concatenate with your shader code.
 */

/**
 * Clamps a value to [0.0, 1.0] range.
 * Useful for normalizing values, alpha, progress, etc.
 */
export const CLAMP01_GLSL = `
float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}
`;

/**
 * Converts world coordinates to clip space coordinates.
 * Requires uniforms: u_cameraPosition, u_viewportSize
 */
export const TO_CLIP_GLSL = `
vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}
`;

/**
 * Common GLSL utilities (both clamp01 and toClip)
 */
export const COMMON_GLSL = CLAMP01_GLSL + TO_CLIP_GLSL;
