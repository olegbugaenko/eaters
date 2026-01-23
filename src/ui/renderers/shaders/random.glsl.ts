/**
 * Random helpers for GLSL (WebGL 2 / GLSL ES 3.0).
 * Includes a legacy sin-hash and a PCG-style hash for improved quality.
 */
export const RANDOM_GLSL = `
uint pcgHash(uint input) {
  uint state = input * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

float randPcg(uint seed) {
  return float(pcgHash(seed)) / 4294967295.0;
}

float randPcg(int particleId, int paramId) {
  uint seed = uint(particleId) * 1664525u + uint(paramId) * 1013904223u + uint(u_currentTime);
  return randPcg(seed);
}

float randRangePcg(int particleId, int paramId, float minVal, float maxVal) {
  return mix(minVal, maxVal, randPcg(particleId, paramId));
}

float hashLegacy(float n) {
  return fract(sin(n * 12.9898) * 43758.5453123);
}

float randLegacy(int particleId, int paramId) {
  float seed = float(particleId) * 7.1831 + float(paramId) * 13.7297 + u_currentTime * 0.001;
  return hashLegacy(seed);
}

float randRangeLegacy(int particleId, int paramId, float minVal, float maxVal) {
  return mix(minVal, maxVal, randLegacy(particleId, paramId));
}
`;
