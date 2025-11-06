import { SceneColor, SceneVector2 } from "../../../../logic/services/SceneObjectManager";

// ============================================
// Fire ring — age computed on GPU from birth time
// ============================================

const FIRE_RING_VERTEX_SHADER = `#version 300 es
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

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_active < 0.5) {
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float maxRadius = a_outerRadius + 130.0; // extra space for tongues
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

const FIRE_RING_FRAGMENT_SHADER = `#version 300 es
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

  if (dist > v_outerRadius + 140.0) discard;

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

interface FireRingProgram {
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    center: number;
    innerRadius: number;
    outerRadius: number;
    birthTimeMs: number;  // <-- NEW
    lifetime: number;
    intensity: number;
    color: number;
    active: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
}

interface FireRingResources {
  program: FireRingProgram;
  quadBuffer: WebGLBuffer;
}

export interface FireRingInstance {
  center: SceneVector2;
  innerRadius: number;
  outerRadius: number;
  birthTimeMs: number; // <-- NEW
  lifetime: number;    // ms (<=0 => infinite)
  intensity: number;
  color: SceneColor;
  active: boolean;
}

interface FireRingBatch {
  instances: FireRingInstance[];
  instanceBuffer: WebGLBuffer | null;
  vao: WebGLVertexArrayObject | null;
  capacity: number;
  needsUpload: boolean; // only when structure (count) changes
}

interface FireRingContext {
  resources: FireRingResources;
  batch: FireRingBatch | null;
}

const UNIT_QUAD = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
   1,  1,
]);

// center(2) + inner(1) + outer(1) + birth(1) + lifetime(1) + intensity(1) + active(1) + color(3)
const COMPONENTS_PER_INSTANCE = 11;
const BYTES_PER_FLOAT = 4;

const contexts = new WeakMap<WebGL2RenderingContext, FireRingContext>();

const createProgram = (gl: WebGL2RenderingContext): FireRingProgram | null => {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  if (!vs) return null;
  gl.shaderSource(vs, FIRE_RING_VERTEX_SHADER);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("Fire ring VS compile:", gl.getShaderInfoLog(vs));
    gl.deleteShader(vs);
    return null;
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fs) { gl.deleteShader(vs); return null; }
  gl.shaderSource(fs, FIRE_RING_FRAGMENT_SHADER);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("Fire ring FS compile:", gl.getShaderInfoLog(fs));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const programObj = gl.createProgram();
  if (!programObj) { gl.deleteShader(vs); gl.deleteShader(fs); return null; }
  gl.attachShader(programObj, vs);
  gl.attachShader(programObj, fs);
  gl.linkProgram(programObj);
  if (!gl.getProgramParameter(programObj, gl.LINK_STATUS)) {
    console.error("Fire ring program link:", gl.getProgramInfoLog(programObj));
    gl.deleteProgram(programObj);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return {
    program: programObj,
    attributes: {
      unitPosition: gl.getAttribLocation(programObj, "a_unitPosition"),
      center:       gl.getAttribLocation(programObj, "a_center"),
      innerRadius:  gl.getAttribLocation(programObj, "a_innerRadius"),
      outerRadius:  gl.getAttribLocation(programObj, "a_outerRadius"),
      birthTimeMs:  gl.getAttribLocation(programObj, "a_birthTimeMs"),
      lifetime:     gl.getAttribLocation(programObj, "a_lifetime"),
      intensity:    gl.getAttribLocation(programObj, "a_intensity"),
      color:        gl.getAttribLocation(programObj, "a_color"),
      active:       gl.getAttribLocation(programObj, "a_active"),
    },
    uniforms: {
      cameraPosition: gl.getUniformLocation(programObj, "u_cameraPosition"),
      viewportSize:   gl.getUniformLocation(programObj, "u_viewportSize"),
      time:           gl.getUniformLocation(programObj, "u_time"),
    },
  };
};

const createResources = (gl: WebGL2RenderingContext): FireRingResources | null => {
  const program = createProgram(gl);
  if (!program) return null;

  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteProgram(program.program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return { program, quadBuffer };
};

const getContext = (gl: WebGL2RenderingContext): FireRingContext | null => {
  let context = contexts.get(gl);
  if (context) return context;
  const resources = createResources(gl);
  if (!resources) return null;
  context = { resources, batch: null };
  contexts.set(gl, context);
  return context;
};

// Тепер не треба тікати age щокадру — достатньо підтримувати активність.
export const updateFireRing = (
  _gl: WebGL2RenderingContext,
  instance: FireRingInstance,
  nowMs: number
): void => {
  if (!instance.active) return;
  if (instance.lifetime > 0) {
    const age = nowMs - instance.birthTimeMs;
    if (age >= instance.lifetime) {
      // дає можливість fade-out на шейдері (ще 0.2*life), але можна й одразу вимикати
      instance.active = false;
    }
  }
};

export const addFireRingInstance = (
  gl: WebGL2RenderingContext,
  instance: FireRingInstance
): void => {
  const context = getContext(gl);
  if (!context) return;

  if (!context.batch) {
    const instanceBuffer = gl.createBuffer();
    if (!instanceBuffer) return;

    context.batch = {
      instances: [],
      instanceBuffer,
      vao: null,
      capacity: 0,
      needsUpload: true,
    };
  }
  context.batch.instances.push(instance);
  context.batch.needsUpload = true; // structural change
};

export const renderFireRings = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number },
  timeMs: number
): void => {
  const context = getContext(gl);
  if (!context || !context.batch) return;

  const { resources, batch } = context;
  const { program, quadBuffer } = resources;

  // remove inactive
  const before = batch.instances.length;
  batch.instances = batch.instances.filter(inst => inst.active);
  if (batch.instances.length === 0) return;
  if (batch.instances.length !== before) batch.needsUpload = true;

  const count = batch.instances.length;
  const data = new Float32Array(count * COMPONENTS_PER_INSTANCE);
  {
    let o = 0;
    for (const inst of batch.instances) {
      data[o++] = inst.center.x;
      data[o++] = inst.center.y;
      data[o++] = inst.innerRadius;
      data[o++] = inst.outerRadius;
      data[o++] = inst.birthTimeMs; // <-- birth, not age
      data[o++] = inst.lifetime;
      data[o++] = inst.intensity;
      const color = inst.color;
      data[o++] = color.r ?? 1.0;
      data[o++] = color.g ?? 1.0;
      data[o++] = color.b ?? 1.0;
      data[o++] = inst.active ? 1.0 : 0.0;
    }
  }

  
  gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
  if (batch.needsUpload || batch.capacity !== count) {
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    batch.capacity = count;
    batch.needsUpload = false;

    // (Re)create VAO
    if (batch.vao) gl.deleteVertexArray(batch.vao);
    batch.vao = gl.createVertexArray();
    if (!batch.vao) return;

    gl.bindVertexArray(batch.vao);

    // quad
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    if (program.attributes.unitPosition >= 0) {
      gl.enableVertexAttribArray(program.attributes.unitPosition);
      gl.vertexAttribPointer(program.attributes.unitPosition, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(program.attributes.unitPosition, 0);
    }

    // instance attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, batch.instanceBuffer);
    const stride = COMPONENTS_PER_INSTANCE * BYTES_PER_FLOAT;
    let off = 0;

    if (program.attributes.center >= 0) {
      gl.enableVertexAttribArray(program.attributes.center);
      gl.vertexAttribPointer(program.attributes.center, 2, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.center, 1);
      off += 2 * BYTES_PER_FLOAT;
    }
    if (program.attributes.innerRadius >= 0) {
      gl.enableVertexAttribArray(program.attributes.innerRadius);
      gl.vertexAttribPointer(program.attributes.innerRadius, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.innerRadius, 1);
      off += 1 * BYTES_PER_FLOAT;
    }
    if (program.attributes.outerRadius >= 0) {
      gl.enableVertexAttribArray(program.attributes.outerRadius);
      gl.vertexAttribPointer(program.attributes.outerRadius, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.outerRadius, 1);
      off += 1 * BYTES_PER_FLOAT;
    }
    if (program.attributes.birthTimeMs >= 0) {
      gl.enableVertexAttribArray(program.attributes.birthTimeMs);
      gl.vertexAttribPointer(program.attributes.birthTimeMs, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.birthTimeMs, 1);
      off += 1 * BYTES_PER_FLOAT;
    }
    if (program.attributes.lifetime >= 0) {
      gl.enableVertexAttribArray(program.attributes.lifetime);
      gl.vertexAttribPointer(program.attributes.lifetime, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.lifetime, 1);
      off += 1 * BYTES_PER_FLOAT;
    }
    if (program.attributes.intensity >= 0) {
      gl.enableVertexAttribArray(program.attributes.intensity);
      gl.vertexAttribPointer(program.attributes.intensity, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.intensity, 1);
      off += 1 * BYTES_PER_FLOAT;
    }
    if (program.attributes.color >= 0) {
      gl.enableVertexAttribArray(program.attributes.color);
      gl.vertexAttribPointer(program.attributes.color, 3, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.color, 1);
      off += 3 * BYTES_PER_FLOAT;
    }
    if (program.attributes.active >= 0) {
      gl.enableVertexAttribArray(program.attributes.active);
      gl.vertexAttribPointer(program.attributes.active, 1, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(program.attributes.active, 1);
    }

    gl.bindVertexArray(null);
  } else {
    // same size — можна нічого не аплоадити, але раз ми вже зібрали data, оновимо буфер (можеш прибрати, якщо не треба)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  if (!batch.vao) return;

  // Render
  gl.useProgram(program.program);

  if (program.uniforms.cameraPosition) {
    gl.uniform2f(program.uniforms.cameraPosition, cameraPosition.x, cameraPosition.y);
  }
  if (program.uniforms.viewportSize) {
    gl.uniform2f(program.uniforms.viewportSize, viewportSize.width, viewportSize.height);
  }
  if (program.uniforms.time) {
    gl.uniform1f(program.uniforms.time, timeMs);
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // soft additive

  gl.bindVertexArray(batch.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.instances.length);
  gl.bindVertexArray(null);

  // restore default
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
};

export const disposeFireRing = (gl: WebGL2RenderingContext): void => {
  const context = contexts.get(gl);
  if (!context) return;

  if (context.batch) {
    if (context.batch.vao) gl.deleteVertexArray(context.batch.vao);
    if (context.batch.instanceBuffer) gl.deleteBuffer(context.batch.instanceBuffer);
  }
  gl.deleteBuffer(context.resources.quadBuffer);
  gl.deleteProgram(context.resources.program.program);

  contexts.delete(gl);
};
