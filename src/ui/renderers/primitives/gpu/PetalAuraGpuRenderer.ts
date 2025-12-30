import { SceneSize, SceneVector2 } from "../../../../logic/services/SceneObjectManager";
import { GpuInstancedPrimitiveLifecycle } from "./GpuInstancedPrimitiveLifecycle";

interface PetalAuraRendererResources {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  attributes: {
    unitPosition: number;
    center: number;
    basePhase: number;
    petalIndex: number;
    petalCount: number;
    innerRadius: number;
    outerRadius: number;
    petalWidth: number;
    rotationSpeed: number;
    color: number;
    alpha: number;
    active: number;
    pointInward: number;
  };
  uniforms: {
    cameraPosition: WebGLUniformLocation | null;
    viewportSize: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
  };
  quadBuffer: WebGLBuffer;
}

export interface PetalAuraInstance {
  position: SceneVector2;
  basePhase: number;
  active: boolean;
  petalIndex?: number; // Індекс пелюстки всередині об'єкта (0, 1, 2, ...) - додається автоматично у writePetalAuraInstance
  // Конфігураційні параметри (через instance attributes для гнучкості)
  petalCount: number;
  innerRadius: number;
  outerRadius: number;
  petalWidth: number;
  rotationSpeed: number;
  color: [number, number, number]; // RGB
  alpha: number;
  pointInward?: boolean; // Якщо true, пелюстки спрямовані всередину (загостренням до центру)
}

interface PetalAuraBatch {
  gl: WebGL2RenderingContext;
  vao: WebGLVertexArrayObject | null;
  instanceBuffer: WebGLBuffer | null;
  capacity: number;
  instances: PetalAuraInstance[];
  activeCount: number;
}

const createInactiveInstance = (): PetalAuraInstance => ({
  position: { x: 0, y: 0 },
  basePhase: 0,
  active: false,
  petalIndex: 0,
  petalCount: 8,
  innerRadius: 20,
  outerRadius: 30,
  petalWidth: 8,
  rotationSpeed: 1.0,
  color: [1.0, 1.0, 1.0],
  alpha: 0.5,
  pointInward: false,
});

// Unit quad для пелюстки (вертикальний трикутник-пелюстка, більший)
const PETAL_VERTICES = new Float32Array([
  -0.5, -0.5,  // лівий низ
   0.5, -0.5,  // правий низ
   0.0,  1.0,  // верх (верхівка пелюстки, подовжена)
]);

const PETAL_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_unitPosition;
in vec2 a_center;
in float a_basePhase;
in float a_petalIndex;
in float a_petalCount;
in float a_innerRadius;
in float a_outerRadius;
in float a_petalWidth;
in float a_rotationSpeed;
in vec3 a_color;
in float a_alpha;
in float a_active;
in float a_pointInward;

uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
uniform float u_time;

out vec2 v_localPosition;
out vec3 v_color;
out float v_alpha;
out float v_distance;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

void main() {
  if (a_active < 0.5) {
    v_localPosition = vec2(0.0);
    v_color = vec3(0.0);
    v_alpha = 0.0;
    v_distance = 0.0;
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
    return;
  }

  float petalCount = max(a_petalCount, 1.0);
  float innerRadius = max(a_innerRadius, 0.0);
  float outerRadius = max(a_outerRadius, innerRadius);
  float petalWidth = max(a_petalWidth, 1.0);
  float rotationSpeed = a_rotationSpeed;
  
  // Обчислюємо кут для цієї пелюстки
  float anglePerPetal = (2.0 * 3.14159265359) / petalCount;
  float petalAngle = a_petalIndex * anglePerPetal;
  
  // Обертання навколо центру
  float time = u_time * 0.001; // Конвертуємо мс в секунди
  float rotation = petalAngle + a_basePhase + time * rotationSpeed;
  
  // Позиція центру пелюстки на радіусі (середина між innerRadius і outerRadius)
  // Центр завжди на середньому радіусі в напрямку rotation
  float petalRadius = (innerRadius + outerRadius) * 0.5;
  vec2 petalCenter = a_center + vec2(
    cos(rotation) * petalRadius,
    sin(rotation) * petalRadius
  );
  
  // Розмір пелюстки: ширина = petalWidth, висота (довжина) = різниця радіусів
  // Базова геометрія має висоту 1.5 (від -0.5 до 1.0), тому масштабуємо на petalLength / 1.5
  float petalLength = outerRadius - innerRadius;
  vec2 petalSize = vec2(petalWidth, petalLength / 1.5);
  
  // Локальні координати в "юнитах" (без масштабування)
  // Центруємо базову геометрію навколо 0 по Y (з -0.5..1.0 до -0.75..0.75),
  // щоб petalCenter був рівно посередині між inner та outer
  vec2 unitOffset = vec2(a_unitPosition.x, a_unitPosition.y - 0.25);
  
  // Обертаємо пелюстку навколо її центру
  // Базова геометрія спрямована вздовж +Y (верхівка в (0, 1.0))
  // Для назовні: потрібен поворот на (rotation - 90°), щоб +Y дивився по radialDirection
  // Для всередину: додаємо 180°, щоб +Y дивився в протилежний бік (до центру)
  float baseRotation = rotation - 1.57079632679; // -90 градусів для назовні
  float petalRotation = baseRotation + (a_pointInward > 0.5 ? 3.14159265359 : 0.0); // +180° якщо всередину
  
  // Для позиції у світі СПОЧАТКУ масштабуємо локальні координати, а потім обертаємо (R * S)
  vec2 petalOffset = unitOffset * petalSize;
  vec2 rotatedOffset = vec2(
    petalOffset.x * cos(petalRotation) - petalOffset.y * sin(petalRotation),
    petalOffset.x * sin(petalRotation) + petalOffset.y * cos(petalRotation)
  );
  
  vec2 world = petalCenter + rotatedOffset;
  
  // У фрагментний шейдер передаємо центровані локальні координати в unit-просторі (без обертання)
  v_localPosition = unitOffset;
  v_color = max(a_color, vec3(0.0));
  v_alpha = clamp(a_alpha, 0.0, 1.0);
  v_distance = length(a_unitPosition);

  gl_Position = vec4(toClip(world), 0.0, 1.0);
}
`;

const PETAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_localPosition;
in vec3 v_color;
in float v_alpha;
in float v_distance;

out vec4 fragColor;

void main() {
  // Пелюстка має форму краплі/трикутника з м'яким затуханням
  // v_localPosition вже в unit координатах (без масштабування)
  vec2 localNorm = v_localPosition;
  float dist = length(localNorm);
  
  // Максимальна відстань від центру для базової форми трикутника
  // Базовий трикутник: (-0.5,-0.5), (0.5,-0.5), (0,1.0)
  // Максимальна відстань від центру ≈ sqrt(0.5^2 + 1.0^2) ≈ 1.12
  // Але додаємо трохи запас для smoothstep
  float maxDist = 1.2;
  if (dist > maxDist) {
    fragColor = vec4(0.0);
    return;
  }
  
  // М'яке затухання від центру до краю
  float falloff = smoothstep(maxDist, 0.2, dist);
  
  // Додаткове затухання від основи до верхівки пелюстки
  // Пелюстка витягнута вгору, тому затухаємо по Y
  float yNorm = localNorm.y / max(dist, 0.001);
  float tipFalloff = smoothstep(-0.3, 0.7, yNorm);
  
  // Додатково затухаємо по ширині (бокові краї)
  // Якщо пелюстка занадто широка відносно висоти
  float widthRatio = abs(localNorm.x) / max(abs(localNorm.y), 0.3);
  float widthFalloff = smoothstep(0.8, 0.2, widthRatio);
  
  float finalAlpha = v_alpha * falloff * tipFalloff * widthFalloff;
  
  fragColor = vec4(v_color, finalAlpha);
}
`;

// Структура instance: center(2), basePhase(1), petalIndex(1), petalCount(1),
// innerRadius(1), outerRadius(1), petalWidth(1), rotationSpeed(1), color(3), alpha(1), active(1), pointInward(1)
const INSTANCE_COMPONENTS = 15;
const INSTANCE_STRIDE = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
// Reusable scratch buffer to avoid per-call Float32Array allocations
const instanceScratch = new Float32Array(INSTANCE_COMPONENTS);

interface PetalAuraRendererContext {
  resources: PetalAuraRendererResources;
  batch: PetalAuraBatch | null;
}

const compileShader = (
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("[PetalAura] Failed to create shader");
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    console.error(`[PetalAura] Shader compilation failed: ${log}`);
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
    console.error("[PetalAura] Failed to compile shaders");
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    console.error("[PetalAura] Failed to create program");
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
    const log = gl.getProgramInfoLog(program);
    console.error(`[PetalAura] Program linking failed: ${log}`);
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

const createResources = (
  gl: WebGL2RenderingContext,
): PetalAuraRendererResources | null => {
  const program = createProgram(gl, PETAL_VERTEX_SHADER, PETAL_FRAGMENT_SHADER);
  if (!program) {
    return null;
  }
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, PETAL_VERTICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const attributes = {
    unitPosition: gl.getAttribLocation(program, "a_unitPosition"),
    center: gl.getAttribLocation(program, "a_center"),
    basePhase: gl.getAttribLocation(program, "a_basePhase"),
    petalIndex: gl.getAttribLocation(program, "a_petalIndex"),
    petalCount: gl.getAttribLocation(program, "a_petalCount"),
    innerRadius: gl.getAttribLocation(program, "a_innerRadius"),
    outerRadius: gl.getAttribLocation(program, "a_outerRadius"),
    petalWidth: gl.getAttribLocation(program, "a_petalWidth"),
    rotationSpeed: gl.getAttribLocation(program, "a_rotationSpeed"),
    color: gl.getAttribLocation(program, "a_color"),
    alpha: gl.getAttribLocation(program, "a_alpha"),
    active: gl.getAttribLocation(program, "a_active"),
    pointInward: gl.getAttribLocation(program, "a_pointInward"),
  };
  
  // Перевіряємо, чи всі атрибути знайдені
  Object.entries(attributes).forEach(([name, location]) => {
    if (location < 0) {
      console.error(`[PetalAura] Attribute '${name}' not found in shader (location: ${location})`);
    }
  });

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

const createPetalAuraBatch = (
  gl: WebGL2RenderingContext,
  capacity: number,
  resources: PetalAuraRendererResources,
): PetalAuraBatch | null => {
  const vao = gl.createVertexArray();
  const instanceBuffer = gl.createBuffer();
  if (!vao || !instanceBuffer) {
    console.error("[PetalAura] Failed to create VAO or instance buffer");
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
  } else {
    console.error("[PetalAura] unitPosition attribute location is invalid:", resources.attributes.unitPosition);
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
  bindAttribute(resources.attributes.basePhase, 1, 2 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.petalIndex, 1, 3 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.petalCount, 1, 4 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.innerRadius, 1, 5 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.outerRadius, 1, 6 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.petalWidth, 1, 7 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.rotationSpeed, 1, 8 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.color, 3, 9 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.alpha, 1, 12 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.active, 1, 13 * Float32Array.BYTES_PER_ELEMENT);
  bindAttribute(resources.attributes.pointInward, 1, 14 * Float32Array.BYTES_PER_ELEMENT);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    gl,
    vao,
    instanceBuffer,
    capacity,
    instances: new Array(capacity).fill(null).map(() => createInactiveInstance()),
    activeCount: 0,
  };
};

const disposePetalAuraBatch = (batch: PetalAuraBatch): void => {
  const { gl, vao, instanceBuffer } = batch;
  if (vao) {
    gl.deleteVertexArray(vao);
  }
  if (instanceBuffer) {
    gl.deleteBuffer(instanceBuffer);
  }
};

// Перепаковуємо активні instances в початок буфера перед рендерингом
// Це необхідно, бо drawArraysInstanced рендерить тільки перші activeCount instances послідовно
// Якщо активні instances не послідовні (наприклад, слоти 0, 2, 5), частина не буде рендеритися
const packActiveInstances = (batch: PetalAuraBatch): void => {
  if (!batch.instanceBuffer) {
    return;
  }
  
  // Збираємо всі активні instances
  const activeInstances: PetalAuraInstance[] = [];
  for (let i = 0; i < batch.capacity; i += 1) {
    const inst = batch.instances[i];
    if (inst && inst.active) {
      activeInstances.push(inst);
    }
  }
  
  batch.activeCount = activeInstances.length;
  
  if (batch.activeCount <= 0) {
    return;
  }
  
  // Перепаковуємо активні instances в початок буфера
  const scratch = new Float32Array(INSTANCE_COMPONENTS);
  batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, batch.instanceBuffer);
  
  for (let i = 0; i < activeInstances.length; i += 1) {
    const instance = activeInstances[i];
    if (!instance) {
      continue;
    }
    
    scratch[0] = instance.position.x;
    scratch[1] = instance.position.y;
    scratch[2] = instance.basePhase;
    scratch[3] = instance.petalIndex ?? 0; // Використовуємо збережений petalIndex
    scratch[4] = instance.petalCount;
    scratch[5] = instance.innerRadius;
    scratch[6] = instance.outerRadius;
    scratch[7] = instance.petalWidth;
    scratch[8] = instance.rotationSpeed;
    scratch[9] = instance.color[0];
    scratch[10] = instance.color[1];
    scratch[11] = instance.color[2];
    scratch[12] = instance.alpha;
    scratch[13] = instance.active ? 1 : 0;
    scratch[14] = instance.pointInward ? 1 : 0;
    
    batch.gl.bufferSubData(
      batch.gl.ARRAY_BUFFER,
      i * INSTANCE_STRIDE,
      scratch,
    );
    
    // Оновлюємо JavaScript об'єкт
    batch.instances[i] = {
      position: { ...instance.position },
      basePhase: instance.basePhase,
      active: instance.active,
      petalIndex: instance.petalIndex ?? 0,
      petalCount: instance.petalCount,
      innerRadius: instance.innerRadius,
      outerRadius: instance.outerRadius,
      petalWidth: instance.petalWidth,
      rotationSpeed: instance.rotationSpeed,
      color: [...instance.color],
      alpha: instance.alpha,
      pointInward: instance.pointInward,
    };
  }
  
  // Очищаємо решту слотів
  for (let i = activeInstances.length; i < batch.capacity; i += 1) {
    scratch[0] = 0;
    scratch[1] = 0;
    scratch[2] = 0;
    scratch[3] = 0;
    scratch[4] = 1;
    scratch[5] = 0;
    scratch[6] = 0;
    scratch[7] = 0;
    scratch[8] = 0;
    scratch[9] = 0;
    scratch[10] = 0;
    scratch[11] = 0;
    scratch[12] = 0;
    scratch[13] = 0;
    scratch[14] = 0;

    batch.gl.bufferSubData(
      batch.gl.ARRAY_BUFFER,
      i * INSTANCE_STRIDE,
      scratch,
    );

    batch.instances[i] = createInactiveInstance();
  }

  batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, null);
};

const resetBatch = (batch: PetalAuraBatch): void => {
  batch.activeCount = 0;
  for (let i = 0; i < batch.capacity; i += 1) {
    batch.instances[i] = createInactiveInstance();
  }
  if (batch.instanceBuffer) {
    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, batch.instanceBuffer);
    batch.gl.bufferData(
      batch.gl.ARRAY_BUFFER,
      batch.capacity * INSTANCE_STRIDE,
      batch.gl.DYNAMIC_DRAW,
    );
    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, null);
  }
};

class PetalAuraEffect
  implements GpuInstancedPrimitiveLifecycle<PetalAuraBatch>
{
  private readonly contexts = new Map<WebGL2RenderingContext, PetalAuraRendererContext>();

  private primaryContext: WebGL2RenderingContext | null = null;

  public onContextAcquired(gl: WebGL2RenderingContext): void {
    if (!this.contexts.has(gl)) {
      const resources = createResources(gl);
      if (!resources) {
        return;
      }
      this.contexts.set(gl, { resources, batch: null });
    }
    this.primaryContext = gl;
  }

  public onContextLost(gl: WebGL2RenderingContext): void {
    const context = this.contexts.get(gl);
    if (context) {
      if (context.batch) {
        disposePetalAuraBatch(context.batch);
      }
      gl.deleteBuffer(context.resources.quadBuffer);
      gl.deleteProgram(context.resources.program);
      this.contexts.delete(gl);
    }
    if (this.primaryContext === gl) {
      this.primaryContext = null;
    }
  }

  public ensureBatch(
    gl: WebGL2RenderingContext,
    capacity: number,
  ): PetalAuraBatch | null {
    this.onContextAcquired(gl);
    const context = this.contexts.get(gl);
    if (!context) {
      return null;
    }
    if (!context.batch || capacity > context.batch.capacity) {
      if (context.batch) {
        disposePetalAuraBatch(context.batch);
      }
      context.batch = createPetalAuraBatch(gl, capacity, context.resources);
      if (!context.batch) {
        return null;
      }
    }
    return context.batch;
  }

  public beforeRender(_gl: WebGL2RenderingContext, _timestampMs: number): void {
    // OPTIMIZATION: Removed packActiveInstances - it was calling bufferSubData 
    // for EVERY slot (512+) every frame! The shader already handles inactive 
    // instances by checking a_active and moving them off-screen.
    // We now render all capacity instances and let the GPU skip inactive ones.
  }

  public render(
    gl: WebGL2RenderingContext,
    cameraPosition: SceneVector2,
    viewportSize: SceneSize,
    timeMs: number,
  ): void {
    const context = this.contexts.get(gl);
    if (!context?.batch || !context.batch.vao || context.batch.capacity <= 0) {
      return;
    }
    const { resources, batch } = context;

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

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.bindVertexArray(batch.vao);
    // OPTIMIZATION: Render all capacity instances - shader skips inactive ones via a_active check
    // This avoids the expensive packActiveInstances that was calling bufferSubData 512+ times per frame
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, batch.capacity);
    gl.bindVertexArray(null);
  }

  public clearInstances(gl?: WebGL2RenderingContext): void {
    if (gl) {
      const context = this.contexts.get(gl);
      if (context?.batch) {
        resetBatch(context.batch);
      }
      return;
    }

    this.contexts.forEach((context) => {
      if (context.batch) {
        resetBatch(context.batch);
      }
    });
  }

  public dispose(): void {
    this.contexts.forEach((context, gl) => {
      if (context.batch) {
        disposePetalAuraBatch(context.batch);
      }
      gl.deleteBuffer(context.resources.quadBuffer);
      gl.deleteProgram(context.resources.program);
    });
    this.contexts.clear();
    this.primaryContext = null;
  }

  public writeInstance(
    batch: PetalAuraBatch,
    baseIndex: number,
    instance: PetalAuraInstance,
  ): number {
    if (!batch.instanceBuffer) {
      return 0;
    }

    const petalCount = Math.max(1, Math.floor(instance.petalCount));
    const clampedIndex = Math.max(0, Math.min(baseIndex, batch.capacity - petalCount));

    const scratch = instanceScratch; // Reuse module-level scratch buffer
    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, batch.instanceBuffer);

    let writtenCount = 0;
    for (let i = 0; i < petalCount; i += 1) {
      const index = clampedIndex + i;
      if (index >= batch.capacity) {
        break;
      }

      const prevActive = batch.instances[index]?.active ?? false;

      scratch[0] = instance.position.x;
      scratch[1] = instance.position.y;
      scratch[2] = instance.basePhase;
      scratch[3] = i;
      scratch[4] = petalCount;
      scratch[5] = instance.innerRadius;
      scratch[6] = instance.outerRadius;
      scratch[7] = instance.petalWidth;
      scratch[8] = instance.rotationSpeed;
      scratch[9] = instance.color[0];
      scratch[10] = instance.color[1];
      scratch[11] = instance.color[2];
      scratch[12] = instance.alpha;
      scratch[13] = instance.active ? 1 : 0;
      scratch[14] = instance.pointInward ? 1 : 0;

      batch.gl.bufferSubData(
        batch.gl.ARRAY_BUFFER,
        index * INSTANCE_STRIDE,
        scratch,
      );

      if (instance.active && !prevActive) {
        batch.activeCount += 1;
      } else if (!instance.active && prevActive) {
        batch.activeCount = Math.max(0, batch.activeCount - 1);
      }

      // Reuse existing instance object to avoid per-frame allocations
      const existing = batch.instances[index];
      if (existing) {
        existing.position.x = instance.position.x;
        existing.position.y = instance.position.y;
        existing.basePhase = instance.basePhase;
        existing.active = instance.active;
        existing.petalIndex = i;
        existing.petalCount = instance.petalCount;
        existing.innerRadius = instance.innerRadius;
        existing.outerRadius = instance.outerRadius;
        existing.petalWidth = instance.petalWidth;
        existing.rotationSpeed = instance.rotationSpeed;
        existing.color[0] = instance.color[0];
        existing.color[1] = instance.color[1];
        existing.color[2] = instance.color[2];
        existing.alpha = instance.alpha;
        existing.pointInward = instance.pointInward;
      } else {
        batch.instances[index] = {
          position: { x: instance.position.x, y: instance.position.y },
          basePhase: instance.basePhase,
          active: instance.active,
          petalIndex: i,
          petalCount: instance.petalCount,
          innerRadius: instance.innerRadius,
          outerRadius: instance.outerRadius,
          petalWidth: instance.petalWidth,
          rotationSpeed: instance.rotationSpeed,
          color: [instance.color[0], instance.color[1], instance.color[2]],
          alpha: instance.alpha,
          pointInward: instance.pointInward,
        };
      }

      writtenCount += 1;
    }

    batch.gl.bindBuffer(batch.gl.ARRAY_BUFFER, null);

    return writtenCount;
  }

  public getPrimaryContext(): WebGL2RenderingContext | null {
    return this.primaryContext;
  }
}

export const petalAuraEffect = new PetalAuraEffect();

export const ensurePetalAuraBatch = (
  gl: WebGL2RenderingContext,
  capacity: number,
): PetalAuraBatch | null => petalAuraEffect.ensureBatch(gl, capacity);

export const writePetalAuraInstance = (
  batch: PetalAuraBatch,
  baseIndex: number,
  instance: PetalAuraInstance,
): number => petalAuraEffect.writeInstance(batch, baseIndex, instance);

export const renderPetalAuras = (
  gl: WebGL2RenderingContext,
  cameraPosition: SceneVector2,
  viewportSize: { width: number; height: number },
  timeMs: number,
): void => petalAuraEffect.render(gl, cameraPosition, viewportSize, timeMs);

export const disposePetalAuraResources = (): void => {
  petalAuraEffect.dispose();
};

export const clearPetalAuraInstances = (gl?: WebGL2RenderingContext): void => {
  petalAuraEffect.clearInstances(gl);
};

export const getPetalAuraGlContext = (): WebGL2RenderingContext | null =>
  petalAuraEffect.getPrimaryContext();

