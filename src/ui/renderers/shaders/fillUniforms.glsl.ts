/**
 * Uniform-based fill data for GPU renderers that draw one polygon per call.
 *
 * Instead of per-vertex attributes (which eat scarce attribute slots), fill
 * parameters are packed into `uniform vec4 u_fillData[FILL_VEC4_COUNT]` and
 * unpacked into the standard varyings the fragment shader already expects.
 *
 * Layout (matches writeFillVertexComponents order in fill.ts):
 *   [0]  fillInfo         (type, stopCount, noiseColorAmp, noiseAlphaAmp)
 *   [1]  fillParams0
 *   [2]  fillParams1
 *   [3]  filaments0
 *   [4]  (filamentEdgeBlur, stopOffsets.xyz)
 *   [5]  stopColor0
 *   [6]  stopColor1
 *   [7]  stopColor2
 *   [8]  (crackUv.xy, crackMask.xy)
 *   [9]  (crackMask.zw, crackEffects.xy)
 *   [10] colorXform
 *   [11] colorAnim0
 *   [12] colorAnim1
 */

export const FILL_VEC4_COUNT = 13;

/**
 * Vertex-shader header that uses uniforms instead of per-vertex attributes
 * for fill data.  Declares only `a_position` as an attribute.
 *
 * Renderers append their own `main()` and call `populateFillVaryings()`
 * before writing `gl_Position`.
 */
export const FILL_UNIFORM_VERTEX_HEADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_position;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform sampler2D u_spriteTexture;
uniform int u_crackAtlasIndex;
uniform vec2 u_crackAtlasGrid;

uniform vec4 u_fillData[${FILL_VEC4_COUNT}];

out vec2 v_worldPosition;
out vec2 v_uv;
out vec4 v_fillInfo;
out vec4 v_fillParams0;
out vec4 v_fillParams1;
out vec4 v_filaments0;
out float v_filamentEdgeBlur;
out vec3 v_stopOffsets;
out vec4 v_stopColor0;
out vec4 v_stopColor1;
out vec4 v_stopColor2;
out vec2 v_crackUv;
out vec4 v_crackMask;
out vec2 v_crackEffects;
out vec4 v_colorXform;
out vec4 v_colorAnim0;
out vec4 v_colorAnim1;
`;

/**
 * GLSL function that unpacks `u_fillData` into fill varyings.
 * Call once at the start of main(), before any local→world transforms.
 */
export const POPULATE_FILL_VARYINGS_GLSL = `
void populateFillVaryings() {
  v_fillInfo        = u_fillData[0];
  v_fillParams0     = u_fillData[1];
  v_fillParams1     = u_fillData[2];
  v_filaments0      = u_fillData[3];
  v_filamentEdgeBlur = u_fillData[4].x;
  v_stopOffsets     = u_fillData[4].yzw;
  v_stopColor0      = u_fillData[5];
  v_stopColor1      = u_fillData[6];
  v_stopColor2      = u_fillData[7];
  v_crackUv         = u_fillData[8].xy;
  v_crackMask       = vec4(u_fillData[8].zw, u_fillData[9].xy);
  v_crackEffects    = u_fillData[9].zw;
  v_colorXform      = u_fillData[10];
  v_colorAnim0      = u_fillData[11];
  v_colorAnim1      = u_fillData[12];
}
`;
