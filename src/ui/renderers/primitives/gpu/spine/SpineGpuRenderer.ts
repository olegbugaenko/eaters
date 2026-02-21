import type { SceneCameraState, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { compileShader, linkProgram } from "@ui/renderers/utils/webglProgram";
import { TO_CLIP_GLSL } from "@ui/renderers/shaders/common.glsl";
import type { SpineAnimParams } from "@ui/renderers/primitives/core/animation.types";

// Maximum spine points supported (each point = x, y, width, axisX, axisY, falloff)
const MAX_SPINE_POINTS = 8;
// Maximum instances per batch
const MAX_INSTANCES = 2048;
// Floats per spine point in texture: x, y, width, axisX, axisY, falloff, padding, padding = 8
const SPINE_POINT_FLOATS = 8;
// Total floats per spine in texture
const SPINE_DATA_FLOATS = MAX_SPINE_POINTS * SPINE_POINT_FLOATS;
// Texels per spine (each texel = RGBA = 4 floats)
const TEXELS_PER_SPINE = SPINE_DATA_FLOATS / 4; // 16 texels per spine
// Texture dimensions: 2D texture with each row = one spine
const SPINE_TEX_WIDTH = TEXELS_PER_SPINE; // 16
const SPINE_TEX_HEIGHT = MAX_INSTANCES; // 2048

/** @deprecated Use SpineAnimParams from animation.types.ts */
export type SpineAnimationParams = SpineAnimParams;

export type SpineGpuColorTransform = {
  brightnessShift: number;
  hueShift: number;
  saturationShift: number;
  alphaMultiplier: number;
};

export type SpineGpuColorAnimation = {
  interval: number;
  keyframeCount: number;
  keyframes: Array<{
    time: number;
    mode: 0 | 1;
    v0: number;
    v1: number;
    v2: number;
    v3: number;
  }>;
};

export type SpineGpuHandle = {
  slotIndex: number;
  segmentCount: number;
  epsilon: number;
  winding: "CW" | "CCW";
  // Animation parameters (updated each frame by primitive)
  anim: SpineAnimationParams;
  fillColor: { r: number; g: number; b: number; a: number };
  colorTransform: SpineGpuColorTransform;
  colorAnimation?: SpineGpuColorAnimation;
  fillDirty: boolean;
};

// Simplified fragment shader for spine - solid color only for performance
const SPINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_fillColor;
in vec4 v_colorXform;
in vec4 v_colorAnim0;
in vec4 v_colorAnim1;
in vec4 v_colorAnim2;
in vec4 v_colorAnim3;
in vec4 v_colorAnim4;
in vec4 v_colorAnim5;
in vec4 v_colorAnim6;
in float v_timeMs;

out vec4 fragColor;

vec3 rgbToHsl(vec3 color) {
  float r = color.r;
  float g = color.g;
  float b = color.b;
  float maxC = max(max(r, g), b);
  float minC = min(min(r, g), b);
  float l = (maxC + minC) * 0.5;
  if (abs(maxC - minC) < 1e-6) {
    return vec3(0.0, 0.0, l);
  }
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  if (maxC == r) {
    h = (g - b) / d + (g < b ? 6.0 : 0.0);
  } else if (maxC == g) {
    h = (b - r) / d + 2.0;
  } else {
    h = (r - g) / d + 4.0;
  }
  h /= 6.0;
  return vec3(h, s, l);
}

float hueToRgb(float p, float q, float t) {
  float x = t;
  if (x < 0.0) x += 1.0;
  if (x > 1.0) x -= 1.0;
  if (x < 1.0 / 6.0) return p + (q - p) * 6.0 * x;
  if (x < 1.0 / 2.0) return q;
  if (x < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - x) * 6.0;
  return p;
}

vec3 hslToRgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s <= 0.0) {
    return vec3(l, l, l);
  }
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hueToRgb(p, q, h + 1.0 / 3.0),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1.0 / 3.0)
  );
}

float applyBrightness(float c, float b) {
  if (b > 0.0) return c + (1.0 - c) * b;
  if (b < 0.0) return c * (1.0 + b);
  return c;
}

vec4 applyTransform(vec4 color, float hueShift, float satShift, float brightShift, float alphaMul) {
  vec3 hsl = rgbToHsl(color.rgb);
  float h = fract(hsl.x + hueShift);
  float s = clamp(hsl.y + satShift, 0.0, 1.0);
  vec3 rgb = hslToRgb(vec3(h, s, hsl.z));
  rgb = vec3(
    clamp(applyBrightness(rgb.r, brightShift), 0.0, 1.0),
    clamp(applyBrightness(rgb.g, brightShift), 0.0, 1.0),
    clamp(applyBrightness(rgb.b, brightShift), 0.0, 1.0)
  );
  return vec4(rgb, clamp(color.a * alphaMul, 0.0, 1.0));
}

vec4 keyframePart(int index) {
  if (index == 0) return v_colorAnim1;
  if (index == 1) return v_colorAnim2;
  if (index == 2) return v_colorAnim3;
  return v_colorAnim4;
}

vec2 keyframeTail(int index) {
  if (index == 0) return vec2(v_colorAnim5.x, v_colorAnim5.y);
  if (index == 1) return vec2(v_colorAnim5.z, v_colorAnim5.w);
  if (index == 2) return vec2(v_colorAnim6.x, v_colorAnim6.y);
  return vec2(v_colorAnim6.z, v_colorAnim6.w);
}

vec4 evalKeyframe(vec4 baseColor, vec4 part, vec2 tail) {
  if (part.y < 0.5) {
    return applyTransform(baseColor, part.z, part.w, tail.x, 1.0);
  }
  return vec4(part.z, part.w, tail.x, tail.y);
}

vec4 applyColorAnimation(vec4 baseColor) {
  float interval = v_colorAnim0.x;
  int keyframeCount = int(floor(v_colorAnim0.y + 0.5));
  if (interval <= 0.0 || keyframeCount <= 0) {
    return baseColor;
  }
  float phase = fract(v_timeMs / max(interval, 1.0));
  if (keyframeCount == 1) {
    return evalKeyframe(baseColor, keyframePart(0), keyframeTail(0));
  }

  int left = 0;
  int right = 0;
  float leftTime = keyframePart(0).x;
  float rightTime = keyframePart(0).x;
  bool found = false;
  for (int i = 0; i < 4; i += 1) {
    if (i >= keyframeCount - 1) break;
    float a = keyframePart(i).x;
    float b = keyframePart(i + 1).x;
    if (phase >= a && phase <= b) {
      left = i;
      right = i + 1;
      leftTime = a;
      rightTime = b;
      found = true;
      break;
    }
  }

  if (!found) {
    left = keyframeCount - 1;
    right = 0;
    leftTime = keyframePart(left).x;
    rightTime = keyframePart(0).x + 1.0;
    if (phase < keyframePart(0).x) {
      phase += 1.0;
    }
  }

  float span = max(rightTime - leftTime, 1e-6);
  float t = clamp((phase - leftTime) / span, 0.0, 1.0);
  vec4 c0 = evalKeyframe(baseColor, keyframePart(left), keyframeTail(left));
  vec4 c1 = evalKeyframe(baseColor, keyframePart(right), keyframeTail(right));
  return mix(c0, c1, t);
}

void main() {
  vec4 transformed = applyTransform(v_fillColor, v_colorXform.y, v_colorXform.z, v_colorXform.x, v_colorXform.w);
  fragColor = applyColorAnimation(transformed);
}
`;

// Instanced vertex shader - reads spine data from texture, instance data from attributes
const SPINE_VERTEX_SHADER_INSTANCED = `#version 300 es
precision highp float;

// Camera uniforms
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;

// Per-instance attributes (using low locations to stay within limits)
layout(location = 0) in vec4 a_instanceAnim0;  // originX, originY, rotation, timeMs
layout(location = 1) in vec4 a_instanceAnim1;  // periodMs, phase, amplitude, epsilon
layout(location = 2) in vec4 a_instanceMeta;   // segmentCount, winding, unused, unused
layout(location = 3) in vec4 a_instanceColor;  // r, g, b, a
layout(location = 4) in vec4 a_instanceColorXform;
layout(location = 5) in vec4 a_instanceColorAnim0;
layout(location = 6) in vec4 a_instanceColorAnim1;
layout(location = 7) in vec4 a_instanceColorAnim2;
layout(location = 8) in vec4 a_instanceColorAnim3;
layout(location = 9) in vec4 a_instanceColorAnim4;
layout(location = 10) in vec4 a_instanceColorAnim5;
layout(location = 11) in vec4 a_instanceColorAnim6;

// Spine geometry texture
uniform sampler2D u_spineDataTex;

out vec4 v_fillColor;
out vec4 v_colorXform;
out vec4 v_colorAnim0;
out vec4 v_colorAnim1;
out vec4 v_colorAnim2;
out vec4 v_colorAnim3;
out vec4 v_colorAnim4;
out vec4 v_colorAnim5;
out vec4 v_colorAnim6;
out float v_timeMs;

${TO_CLIP_GLSL}

vec4 fetchSpineTexel(int spineSlot, int texelIndex) {
  // 2D texture: row = spineSlot, col = texelIndex
  return texelFetch(u_spineDataTex, ivec2(texelIndex, spineSlot), 0);
}

void getSpinePoint(int spineSlot, int pointIdx, out vec2 pos, out float width, out vec2 axis, out float falloff) {
  int texelBase = pointIdx * 2;
  vec4 t0 = fetchSpineTexel(spineSlot, texelBase);
  vec4 t1 = fetchSpineTexel(spineSlot, texelBase + 1);
  pos = t0.xy;
  width = t0.z;
  axis = vec2(t0.w, t1.x);
  falloff = t1.y;
}

vec2 deformSpinePoint(int spineSlot, int idx, float timeMs, float periodMs, float phase, float amplitude) {
  vec2 pos;
  float width;
  vec2 axis;
  float falloff;
  getSpinePoint(spineSlot, idx, pos, width, axis, falloff);
  
  if (idx == 0) {
    return pos;
  }
  float omega = 6.28318530718 / max(periodMs, 1.0);
  float baseAngle = omega * timeMs + phase;
  float segmentPhase = float(idx) * 0.5;
  float s = sin(baseAngle + segmentPhase);
  float displacement = amplitude * falloff * s;
  return pos + axis * displacement;
}

void main() {
  vec2 origin = a_instanceAnim0.xy;
  float rotation = a_instanceAnim0.z;
  float timeMs = a_instanceAnim0.w;
  float periodMs = a_instanceAnim1.x;
  float phase = a_instanceAnim1.y;
  float amplitude = a_instanceAnim1.z;
  float epsilon = a_instanceAnim1.w;
  int segmentCount = int(a_instanceMeta.x + 0.5);
  int winding = int(a_instanceMeta.y + 0.5);
  int spineSlot = gl_InstanceID;
  
  int segmentIdx = gl_VertexID / 6;
  int vertexInQuad = gl_VertexID % 6;
  
  if (segmentIdx >= segmentCount) {
    gl_Position = vec4(0.0);
    v_fillColor = vec4(0.0);
    v_colorXform = vec4(0.0, 0.0, 0.0, 1.0);
    v_colorAnim0 = vec4(0.0);
    v_colorAnim1 = vec4(0.0);
    v_colorAnim2 = vec4(0.0);
    v_colorAnim3 = vec4(0.0);
    v_colorAnim4 = vec4(0.0);
    v_colorAnim5 = vec4(0.0);
    v_colorAnim6 = vec4(0.0);
    v_timeMs = 0.0;
    return;
  }
  
  vec2 a = deformSpinePoint(spineSlot, segmentIdx, timeMs, periodMs, phase, amplitude);
  vec2 b = deformSpinePoint(spineSlot, segmentIdx + 1, timeMs, periodMs, phase, amplitude);
  
  vec2 posA, posB;
  float widthA, widthB;
  vec2 axisA, axisB;
  float falloffA, falloffB;
  getSpinePoint(spineSlot, segmentIdx, posA, widthA, axisA, falloffA);
  getSpinePoint(spineSlot, segmentIdx + 1, posB, widthB, axisB, falloffB);
  
  float wa = widthA * 0.5;
  float wb = widthB * 0.5;
  
  vec2 dir = b - a;
  float len = length(dir);
  if (len < 0.0001) len = 1.0;
  vec2 tangent = dir / len;
  vec2 normal = vec2(-tangent.y, tangent.x);
  
  vec2 aCap = a - tangent * epsilon;
  vec2 bCap = b + tangent * epsilon;
  
  vec2 aL = aCap + normal * wa;
  vec2 aR = aCap - normal * wa;
  vec2 bL = bCap + normal * wb;
  vec2 bR = bCap - normal * wb;
  
  vec2 localPos;
  if (winding == 0) {
    if (vertexInQuad == 0) localPos = aL;
    else if (vertexInQuad == 1) localPos = aR;
    else if (vertexInQuad == 2) localPos = bL;
    else if (vertexInQuad == 3) localPos = aR;
    else if (vertexInQuad == 4) localPos = bR;
    else localPos = bL;
  } else {
    if (vertexInQuad == 0) localPos = aR;
    else if (vertexInQuad == 1) localPos = aL;
    else if (vertexInQuad == 2) localPos = bR;
    else if (vertexInQuad == 3) localPos = aL;
    else if (vertexInQuad == 4) localPos = bL;
    else localPos = bR;
  }
  
  float cosR = cos(rotation);
  float sinR = sin(rotation);
  vec2 rotated = vec2(
    localPos.x * cosR - localPos.y * sinR,
    localPos.x * sinR + localPos.y * cosR
  );
  vec2 worldPos = origin + rotated;

  gl_Position = vec4(toClip(worldPos), 0.0, 1.0);
  v_fillColor = a_instanceColor;
  v_colorXform = a_instanceColorXform;
  v_colorAnim0 = a_instanceColorAnim0;
  v_colorAnim1 = a_instanceColorAnim1;
  v_colorAnim2 = a_instanceColorAnim2;
  v_colorAnim3 = a_instanceColorAnim3;
  v_colorAnim4 = a_instanceColorAnim4;
  v_colorAnim5 = a_instanceColorAnim5;
  v_colorAnim6 = a_instanceColorAnim6;
  v_timeMs = timeMs;
}
`;

// Instance data layout: 16 floats per instance
// [0-3]: originX, originY, rotation, timeMs
// [4-7]: periodMs, phase, amplitude, epsilon
// [8-11]: segmentCount, winding, unused, unused
// [12-15]: r, g, b, a
const INSTANCE_FLOATS = 48;

class SpineGpuRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  
  // Instancing resources
  private vao: WebGLVertexArrayObject | null = null;
  private instanceBuffer: WebGLBuffer | null = null;
  private spineDataTexture: WebGLTexture | null = null;
  
  // Data arrays
  private instanceData = new Float32Array(MAX_INSTANCES * INSTANCE_FLOATS);
  private spineTextureData = new Float32Array(SPINE_TEX_WIDTH * SPINE_TEX_HEIGHT * 4);
  
  // Slot management
  private handles: SpineGpuHandle[] = [];
  private freeSlots: number[] = [];
  private activeCount = 0;
  private needsSpineTexUpload = false;
  
  private maxVerticesPerSpine = 0;
  
  // Uniform locations
  private cameraPositionLocation: WebGLUniformLocation | null = null;
  private viewportSizeLocation: WebGLUniformLocation | null = null;
  private spineDataTexLocation: WebGLUniformLocation | null = null;

  public setContext(gl: WebGL2RenderingContext | null): void {
    // console.log("[SpineGpuRenderer] setContext called, same?", this.gl === gl, "activeCount before:", this.activeCount);
    if (this.gl === gl) {
      return;
    }
    // console.log("[SpineGpuRenderer] DIFFERENT GL - disposing! activeCount was:", this.activeCount);
    this.dispose();
    this.gl = gl;
    if (!gl) {
      return;
    }

    this.vertexShader = compileShader(gl, gl.VERTEX_SHADER, SPINE_VERTEX_SHADER_INSTANCED);
    this.fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, SPINE_FRAGMENT_SHADER);
    this.program = linkProgram(gl, this.vertexShader, this.fragmentShader);

    this.maxVerticesPerSpine = (MAX_SPINE_POINTS - 1) * 6;

    this.cameraPositionLocation = gl.getUniformLocation(this.program, "u_cameraPosition");
    this.viewportSizeLocation = gl.getUniformLocation(this.program, "u_viewportSize");
    this.spineDataTexLocation = gl.getUniformLocation(this.program, "u_spineDataTex");
    
    this.initializeResources(gl);
  }
  
  private initializeResources(gl: WebGL2RenderingContext): void {
    this.vao = gl.createVertexArray();
    if (!this.vao) return;
    
    gl.bindVertexArray(this.vao);
    
    // Create instance buffer
    this.instanceBuffer = gl.createBuffer();
    if (!this.instanceBuffer) return;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData, gl.DYNAMIC_DRAW);
    
    const instanceStride = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT;
    
    // a_instanceAnim0 at location 0: vec4 (originX, originY, rotation, timeMs)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, instanceStride, 0);
    gl.vertexAttribDivisor(0, 1);
    
    // a_instanceAnim1 at location 1: vec4 (periodMs, phase, amplitude, epsilon)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, instanceStride, 4 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(1, 1);
    
    // a_instanceMeta at location 2: vec4 (segmentCount, winding, unused, unused)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, instanceStride, 8 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(2, 1);
    
    // a_instanceColor at location 3: vec4 (r, g, b, a)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, instanceStride, 12 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(3, 1);

    // a_instanceColorXform at location 4: vec4 (brightnessShift, hueShift, saturationShift, alphaMultiplier)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, instanceStride, 16 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(4, 1);

    // a_instanceColorAnim0..6 at locations 5..11
    for (let i = 0; i < 7; i += 1) {
      const location = 5 + i;
      const floatOffset = 20 + i * 4;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 4, gl.FLOAT, false, instanceStride, floatOffset * Float32Array.BYTES_PER_ELEMENT);
      gl.vertexAttribDivisor(location, 1);
    }
    
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    
    // Create spine data texture (2D: width=TEXELS_PER_SPINE, height=MAX_INSTANCES)
    this.spineDataTexture = gl.createTexture();
    if (!this.spineDataTexture) return;
    
    gl.bindTexture(gl.TEXTURE_2D, this.spineDataTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA32F,
      SPINE_TEX_WIDTH, SPINE_TEX_HEIGHT, 0,
      gl.RGBA, gl.FLOAT, this.spineTextureData
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Initialize free slots
    this.freeSlots = [];
    for (let i = MAX_INSTANCES - 1; i >= 0; i--) {
      this.freeSlots.push(i);
    }
  }

  public acquireHandle(options: {
    spinePoints: Array<{ x: number; y: number; width: number }>;
    axis: "normal" | "tangent";
    falloff: "tip" | "root" | "none";
    epsilon: number;
    winding: "CW" | "CCW";
  }): SpineGpuHandle | null {
    // console.log("[SpineGpuRenderer] acquireHandle called, freeSlots:", this.freeSlots.length, "activeCount before:", this.activeCount);
    if (!this.gl || this.freeSlots.length === 0) {
      console.warn("[SpineGpuRenderer] acquireHandle FAILED - no gl or no free slots");
      return null;
    }
    
    const pointCount = Math.min(options.spinePoints.length, MAX_SPINE_POINTS);
    if (pointCount < 2) {
      return null;
    }
    
    const slotIndex = this.freeSlots.pop()!;
    const segmentCount = pointCount - 1;
    
    // Write spine geometry to texture data (2D layout: row = slotIndex)
    const texelsPerPoint = 2;
    // Base offset for this row in the texture data array
    const rowOffset = slotIndex * SPINE_TEX_WIDTH * 4;
    
    for (let i = 0; i < pointCount; i++) {
      const p = options.spinePoints[i]!;
      
      // Compute axis
      let axisX = 0, axisY = 1;
      if (i < segmentCount) {
        const a = options.spinePoints[i]!;
        const b = options.spinePoints[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const tangentX = dx / len;
        const tangentY = dy / len;
        if (options.axis === "tangent") {
          axisX = tangentX;
          axisY = tangentY;
        } else {
          axisX = -tangentY;
          axisY = tangentX;
        }
      } else if (i > 0) {
        // Read previous point's axis from the same row
        const prevTexelCol = (i - 1) * texelsPerPoint;
        axisX = this.spineTextureData[rowOffset + prevTexelCol * 4 + 3]!;
        axisY = this.spineTextureData[rowOffset + (prevTexelCol + 1) * 4]!;
      }
      
      // Compute falloff
      let falloff = 1;
      if (pointCount > 1 && i > 0) {
        const ratio = i / (pointCount - 1);
        if (options.falloff === "tip") {
          falloff = ratio;
        } else if (options.falloff === "root") {
          falloff = 1 - ratio;
        }
      } else {
        falloff = 0;
      }
      
      // Column offset within the row
      const texelCol = i * texelsPerPoint;
      const baseIdx = rowOffset + texelCol * 4;
      this.spineTextureData[baseIdx + 0] = p.x;
      this.spineTextureData[baseIdx + 1] = p.y;
      this.spineTextureData[baseIdx + 2] = p.width;
      this.spineTextureData[baseIdx + 3] = axisX;
      this.spineTextureData[baseIdx + 4] = axisY;
      this.spineTextureData[baseIdx + 5] = falloff;
      this.spineTextureData[baseIdx + 6] = 0;
      this.spineTextureData[baseIdx + 7] = 0;
    }
    
    // Zero out unused points in the row
    for (let i = pointCount; i < MAX_SPINE_POINTS; i++) {
      const texelCol = i * texelsPerPoint;
      const baseIdx = rowOffset + texelCol * 4;
      for (let j = 0; j < 8; j++) {
        this.spineTextureData[baseIdx + j] = 0;
      }
    }
    
    this.needsSpineTexUpload = true;
    
    const handle: SpineGpuHandle = {
      slotIndex,
      segmentCount,
      epsilon: options.epsilon,
      winding: options.winding,
      anim: {
        timeMs: 0,
        periodMs: 1400,
        phase: 0,
        amplitude: 1,
        origin: { x: 0, y: 0 },
        rotation: 0,
      },
      fillColor: { r: 1, g: 1, b: 1, a: 1 },
      colorTransform: { brightnessShift: 0, hueShift: 0, saturationShift: 0, alphaMultiplier: 1 },
      colorAnimation: undefined,
      fillDirty: true,
    };
    
    this.handles[slotIndex] = handle;
    this.activeCount++;
    // console.log("[SpineGpuRenderer] acquireHandle SUCCESS - slot:", slotIndex, "activeCount now:", this.activeCount);
    
    return handle;
  }

  /**
   * Unified acquire API (alias for acquireHandle).
   */
  public acquire(options: {
    spinePoints: Array<{ x: number; y: number; width: number }>;
    axis: "normal" | "tangent";
    falloff: "tip" | "root" | "none";
    epsilon: number;
    winding: "CW" | "CCW";
  }): SpineGpuHandle | null {
    return this.acquireHandle(options);
  }
  
  public isHandleValid(handle: SpineGpuHandle): boolean {
    return this.handles[handle.slotIndex] === handle;
  }

  public updateHandleFill(
    handle: SpineGpuHandle,
    color: { r: number; g: number; b: number; a: number },
    colorTransform?: SpineGpuColorTransform,
    colorAnimation?: SpineGpuColorAnimation
  ): void {
    handle.fillColor.r = color.r;
    handle.fillColor.g = color.g;
    handle.fillColor.b = color.b;
    handle.fillColor.a = color.a;
    handle.colorTransform = colorTransform
      ? {
          brightnessShift: colorTransform.brightnessShift,
          hueShift: colorTransform.hueShift,
          saturationShift: colorTransform.saturationShift,
          alphaMultiplier: colorTransform.alphaMultiplier,
        }
      : { brightnessShift: 0, hueShift: 0, saturationShift: 0, alphaMultiplier: 1 };
    handle.colorAnimation = colorAnimation
      ? {
          interval: colorAnimation.interval,
          keyframeCount: colorAnimation.keyframeCount,
          keyframes: colorAnimation.keyframes.map((keyframe) => ({ ...keyframe })),
        }
      : undefined;
    handle.fillDirty = true;
  }

  /**
   * Unified update API (alias for updateHandleFill).
   */
  public update(
    handle: SpineGpuHandle,
    color: { r: number; g: number; b: number; a: number },
    colorTransform?: SpineGpuColorTransform,
    colorAnimation?: SpineGpuColorAnimation
  ): void {
    this.updateHandleFill(handle, color, colorTransform, colorAnimation);
  }

  public releaseHandle(handle: SpineGpuHandle): void {
    if (handle.slotIndex < 0 || handle.slotIndex >= MAX_INSTANCES) {
      return;
    }
    // Only release if this handle is actually registered
    if (this.handles[handle.slotIndex] !== handle) {
      return;
    }
    
    const offset = handle.slotIndex * INSTANCE_FLOATS;
    for (let i = 0; i < INSTANCE_FLOATS; i++) {
      this.instanceData[offset + i] = 0;
    }
    
    this.freeSlots.push(handle.slotIndex);
    delete this.handles[handle.slotIndex];
    this.activeCount--;
  }

  /**
   * Unified release API (alias for releaseHandle).
   */
  public release(handle: SpineGpuHandle): void {
    this.releaseHandle(handle);
  }
  
  private beforeRender(): void {
    const gl = this.gl;
    if (!gl) return;
    
    // Update instance data from handles
    for (let i = 0; i < MAX_INSTANCES; i++) {
      const handle = this.handles[i];
      if (!handle) continue;
      
      const offset = i * INSTANCE_FLOATS;
      const anim = handle.anim;
      
      this.instanceData[offset + 0] = anim.origin.x;
      this.instanceData[offset + 1] = anim.origin.y;
      this.instanceData[offset + 2] = anim.rotation;
      this.instanceData[offset + 3] = anim.timeMs;
      this.instanceData[offset + 4] = anim.periodMs;
      this.instanceData[offset + 5] = anim.phase;
      this.instanceData[offset + 6] = anim.amplitude;
      this.instanceData[offset + 7] = handle.epsilon;
      this.instanceData[offset + 8] = handle.segmentCount;
      this.instanceData[offset + 9] = handle.winding === "CW" ? 1 : 0;
      this.instanceData[offset + 10] = 0; // unused
      this.instanceData[offset + 11] = 0; // unused
      this.instanceData[offset + 12] = handle.fillColor.r;
      this.instanceData[offset + 13] = handle.fillColor.g;
      this.instanceData[offset + 14] = handle.fillColor.b;
      this.instanceData[offset + 15] = handle.fillColor.a;
      this.instanceData[offset + 16] = handle.colorTransform.brightnessShift;
      this.instanceData[offset + 17] = handle.colorTransform.hueShift;
      this.instanceData[offset + 18] = handle.colorTransform.saturationShift;
      this.instanceData[offset + 19] = handle.colorTransform.alphaMultiplier;

      for (let j = 0; j < 28; j += 1) {
        this.instanceData[offset + 20 + j] = 0;
      }
      const animation = handle.colorAnimation;
      if (animation && animation.interval > 0 && animation.keyframeCount > 0) {
        this.instanceData[offset + 20] = animation.interval;
        this.instanceData[offset + 21] = Math.min(animation.keyframeCount, 4);
        const maxFrames = Math.min(animation.keyframes.length, 4);
        for (let k = 0; k < maxFrames; k += 1) {
          const keyframe = animation.keyframes[k]!;
          const base = offset + 24 + k * 4;
          this.instanceData[base + 0] = keyframe.time;
          this.instanceData[base + 1] = keyframe.mode;
          this.instanceData[base + 2] = keyframe.v0;
          this.instanceData[base + 3] = keyframe.v1;
        }
        for (let k = 0; k < maxFrames; k += 1) {
          const keyframe = animation.keyframes[k]!;
          const base = offset + 40 + k * 2;
          this.instanceData[base + 0] = keyframe.v2;
          this.instanceData[base + 1] = keyframe.v3;
        }
      }
    }
    
    // Upload instance buffer
    if (this.instanceBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    
    // Upload spine texture if needed
    if (this.needsSpineTexUpload && this.spineDataTexture) {
      gl.bindTexture(gl.TEXTURE_2D, this.spineDataTexture);
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0,
        SPINE_TEX_WIDTH, SPINE_TEX_HEIGHT,
        gl.RGBA, gl.FLOAT, this.spineTextureData
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.needsSpineTexUpload = false;
    }
  }

  public render(gl: WebGL2RenderingContext, cameraState: SceneCameraState): void {
    if (!this.program || this.activeCount === 0 || !this.vao) {
      // console.log("[SpineGpuRenderer] render skipped:", { hasProgram: !!this.program, activeCount: this.activeCount, hasVao: !!this.vao });
      return;
    }
    // console.log("[SpineGpuRenderer] rendering", this.activeCount, "spines");
    
    this.beforeRender();
    
    gl.useProgram(this.program);
    
    if (this.cameraPositionLocation) {
      gl.uniform2f(this.cameraPositionLocation, cameraState.position.x, cameraState.position.y);
    }
    if (this.viewportSizeLocation) {
      gl.uniform2f(this.viewportSizeLocation, cameraState.viewportSize.width, cameraState.viewportSize.height);
    }
    
    // Bind spine data texture
    if (this.spineDataTexture && this.spineDataTexLocation !== null) {
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, this.spineDataTexture);
      gl.uniform1i(this.spineDataTexLocation, 7);
    }
    
    gl.bindVertexArray(this.vao);
    
    // Single instanced draw call for all spines!
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.maxVerticesPerSpine, MAX_INSTANCES);
    
    gl.bindVertexArray(null);
  }

  private dispose(): void {
    const gl = this.gl;
    if (!gl) {
      return;
    }
    
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
      this.vao = null;
    }
    if (this.instanceBuffer) {
      gl.deleteBuffer(this.instanceBuffer);
      this.instanceBuffer = null;
    }
    if (this.spineDataTexture) {
      gl.deleteTexture(this.spineDataTexture);
      this.spineDataTexture = null;
    }
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.vertexShader) {
      gl.deleteShader(this.vertexShader);
    }
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
    }
    this.program = null;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.handles = [];
    this.freeSlots = [];
    this.activeCount = 0;
    
    // Clear data arrays to prevent stale data from being uploaded on re-init
    this.instanceData.fill(0);
    this.spineTextureData.fill(0);
    this.needsSpineTexUpload = false;
  }
}

export const spineGpuRenderer = new SpineGpuRenderer();
