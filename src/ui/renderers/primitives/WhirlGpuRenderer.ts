import { SceneVector2 } from "../../../logic/services/SceneObjectManager";

interface WhirlRendererResources {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    center: number;
    radius: number;
    phase: number;
    intensity: number;
    active: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  quadBuffer: WebGLBuffer;
}

export interface WhirlInstance {
  position: SceneVector2;
  radius: number;
  phase: number;
  intensity: number;
  active: boolean;
}

interface WhirlBatch {
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject | null;
  instanceBuffer: WebGLBuffer | null;
  capacity: number;
  instances: WhirlInstance[];
  activeCount: number;
}

const UNIT_QUAD_VERTICES = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5,
]);

const WHIRL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_center;
in float a_radius;
in float a_phase;
in float a_intensity;
in float a_active;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time;

out vec2 v_localPosition;
out float v_radius;
out float v_phase;
out float v_intensity;
out float v_time;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_active < 0.5) {
    v_localPosition = vec2(0.0);
    v_radius = 0.0;
    v_phase = 0.0;
    v_intensity = 0.0;
    v_time = u_time;
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

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const WHIRL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPosition;
in float v_radius;
in float v_phase;
in float v_intensity;
in float v_time;

out vec4 fragColor;

float clamp01(float value) {
  return clamp(value, 0.0, 1.0);
}

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
  float time = v_time * 0.0025;
  
  // Spiral arms - основні спіральні лінії
  float spiralArms = 6.0;
  float spiralTwist = -distance * 7.0 + time * 16.0 + v_phase * 0.7;
  float spiral = sin(angle * spiralArms + spiralTwist);
  float spiralSharp = smoothstep(0.4, 0.7, spiral);
  
  // Додаткові спіралі для деталей
  float spiralArms2 = 12.0;
  float spiralTwist2 = -distance * 4.0 + time * 12.0 + v_phase;
  float spiral2 = cos(angle * spiralArms2 + spiralTwist2);
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

  // Кольори - темніші зовні, світліші всередині
  vec3 innerColor = vec3(0.95, 0.88, 0.72);
  vec3 midColor = vec3(0.85, 0.72, 0.58);
  vec3 outerColor = vec3(0.68, 0.55, 0.43);
  
  // Міксуємо кольори залежно від відстані та паттерну
  float distMix = clamp01(distance * 1.2);
  vec3 baseColor = mix(innerColor, midColor, distMix * 0.6);
  baseColor = mix(baseColor, outerColor, distMix);
  
  // Підсвічуємо спіральні лінії
  vec3 color = mix(baseColor, innerColor, spiralSharp * 0.3);

  fragColor = vec4(color, alpha);
}
`;

const INSTANCE_COMPONENTS = 6;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;

const rendererContexts = new Map<WebGL2RenderingContext, {
  resources: WhirlRendererResources;
  batch: WhirlBatch | null;
}>();

const compileShader = (
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createProgram = (
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): WebGLProgram | null => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

const createResources = (
  gl: WebGL2RenderingContext,
): WhirlRendererResources | null => {
  const program = createProgram(gl, WHIRL_VERTEX_SHADER, WHIRL_FRAGMENT_SHADER);
  if (!program) {
    return null;
  }
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_VERTICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const attributes = {
    unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
    center: gl.getAttribLocation(program, "a_center"),
    radius: gl.getAttribLocation(program, "a_radius"),
    phase: gl.getAttribLocation(program, "a_phase"),
    intensity: gl.getAttribLocation(program, "a_intensity"),
    active: gl.getAttribLocation(program, "a_active"),
  };

  const uniforms = {
    cameraPosition: gl.getUniformLocation(program, "u_cameraPosition"),
    viewportSize: gl.getUniformLocation(program, "u_viewportSize"),
    time: gl.getUniformLocation(program, "u_time"),
  };

  return {
    gl,
    program,
    attributes,
    uniforms,
    quadBuffer,
  };
};

const createWhirlBatch = (
  gl: WebGL2RenderingContext,
  capacity: number,
  resources: WhirlRendererResources,
): WhirlBatch | null => {
  const vao = gl.createVertexArray();
  const instanceBuffer = gl.createBuffer();
  if (!vao || !instanceBuffer) {
    if (vao) gl.deleteVertexArray(vao);
    if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
    return null;
  }

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, resources.quadBuffer);
  if (resources.attributes.unitPosition >= 0) {
    gl.enableVertexAttribArray(resources.attributes.unitPosition);
    gl.vertexAttribPointer(
      resources.attributes.unitPosition,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );
    gl.vertexAttribDivisor(resources.attributes.unitPosition, 0);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, capacity * INSTANCE_STRIDE, gl.DYNAMIC_DRAW);

  const bindAttribute = (location: number, size: number, offset: number) => {
    if (location < 0) {
      return;
    }
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(
      location,
      size,
      gl.FLOAT,
      false,
      INSTANCE_STRIDE,
      offset,
    );
    gl.vertexAttribDivisor(location, 1);
  };

  bindAttribute(resources.attributes.center, 2, 0);
  bindAttribute(resources.attributes.radius, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.phase, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.intensity, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.active, 1, 5 * Float32Array.BYTES_PER_ELEMENT);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    gl,
    vao,
    instanceBuffer,
    capacity,
    instances: new Array(capacity).fill(null).map(() => ({
      position: { x: 0, y: 0 },
      radius: 0,
      phase: 0,
      intensity: 0,
      active: false,
    })),
    activeCount: 0,
  };
};

export const ensureWhirlBatch = (
  gl: WebGL2RenderingContext,
  capacity: number,
): WhirlBatch | null => {
  let context = rendererContexts.get(gl);
  if (!context) {
    const resources = createResources(gl);
    if (!resources) {
      return null;
    }
    context = { resources, batch: null };
    rendererContexts.set(gl, context);
  }

  const { resources } = context;

  if (!context.batch || capacity > context.batch.capacity) {
    if (context.batch) {
      disposeWhirlBatch(context.batch);
    }
    context.batch = createWhirlBatch(gl, capacity, resources);
  }

  return context.batch;
};

const disposeWhirlBatch = (batch: WhirlBatch): void => {
  const { gl, vao, instanceBuffer } = batch;
  if (vao) {
    gl.deleteVertexArray(vao);
  }
  if (instanceBuffer) {
    gl.deleteBuffer(instanceBuffer);
  }
};

export const writeWhirlInstance = (
  batch: WhirlBatch,
  index: number,
  instance: WhirlInstance,
): void => {
  if (!batch.instanceBuffer) {
    return;
  }
  const clampedIndex = Math.max(0, Math.min(index, batch.capacity - 1));
  const scratch = new Float32Array(INSTANCE_COMPONENTS);
  scratch[0] = instance.position.x;
  scratch[1] = instance.position.y;
  scratch[2] = instance.radius;
  scratch[3] = instance.phase;
  scratch[4] = instance.intensity;
  scratch[5] = instance.active ? 1 : 0;
  batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, batch.instanceBuffer);
  batch.gl.bufferSubData(
    batch.gl.ARRAY_BUFFER,
    clampedIndex * INSTANCE_STRIDE,
    scratch,
  );
  batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, null);

  const previous = batch.instances[clampedIndex];
  const prevActive = previous?.active ?? false;
  batch.instances[clampedIndex] = { ...instance };
  if (instance.active && !prevActive) {
    batch.activeCount += 1;
  } else if (!instance.active && prevActive) {
    batch.activeCount = Math.max(0, batch.activeCount - 1);
  }
};

export const renderWhirls = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number },
  timeMs: number,
): void => {
  const context = rendererContexts.get(gl);
  if (!context || !context.batch || context.batch.activeCount <= 0) {
    return;
  }

  const { resources, batch } = context;
  if (!batch.vao) {
    return;
  }

  gl.useProgram(resources.program);
  if (resources.uniforms.cameraPosition) {
    gl.uniform2f(
      resources.uniforms.cameraPosition,
      cameraPosition.x,
      cameraPosition.y,
    );
  }
  if (resources.uniforms.viewportSize) {
    gl.uniform2f(
      resources.uniforms.viewportSize,
      viewportSize.width,
      viewportSize.height,
    );
  }
  if (resources.uniforms.time) {
    gl.uniform1f(resources.uniforms.time, timeMs);
  }

  gl.bindVertexArray(batch.vao);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.activeCount);
  gl.bindVertexArray(null);
};

export const disposeWhirlResources = (): void => {
  rendererContexts.forEach((context) => {
    const { gl, program, quadBuffer } = context.resources;
    if (context.batch) {
      disposeWhirlBatch(context.batch);
    }
    gl.deleteBuffer(quadBuffer);
    gl.deleteProgram(program);
  });
  rendererContexts.clear();
};
