import {
  FILL_TYPES,
  SceneFill,
  SceneObjectInstance,
  SceneVector2,
  SceneColor,
} from "../../../logic/services/SceneObjectManager";
import type { SceneCameraState } from "../../../logic/services/SceneObjectManager";
import {
  FILL_COMPONENTS,
  FILL_PARAMS0_COMPONENTS,
  FILL_PARAMS1_COMPONENTS,
  MAX_GRADIENT_STOPS,
  POSITION_COMPONENTS,
  STOP_COLOR_COMPONENTS,
  STOP_OFFSETS_COMPONENTS,
} from "../objects/ObjectRenderer";
import { writeFillVertexComponents } from "../primitives/fill";
import {
  sanitizeParticleEmitterConfig,
  type ParticleEmitterBaseConfig,
  type ParticleEmitterParticleState,
} from "../primitives/ParticleEmitterPrimitive";

type InstancedArraysExt = ANGLE_instanced_arrays;

interface EmitterConfigBase extends ParticleEmitterBaseConfig {
  baseSpeed?: number;
  speedVariation?: number;
  spread?: number;
  physicalSize?: number;
  // Explosion-specific
  spawnRadius?: { min: number; max: number };
  arc?: number;
  direction?: number;
}

interface EmitterState {
  objectId: string;
  config: EmitterConfigBase;
  particles: ParticleEmitterParticleState[];
  spawnAccumulator: number;
  ageMs: number;
}

const VERTICES_PER_QUAD = 6; // two triangles
const MAX_DELTA_MS = 250;
const MIN_PARTICLE_SIZE = 0.0001;
const PARTICLE_FILL_SCRATCH = new Float32Array(FILL_COMPONENTS);
const INACTIVE_PARTICLE_FILL = new Float32Array(FILL_COMPONENTS);

const INSTANCE_COMPONENTS =
  // world center (x, y) + size (w, h)
  2 + 2 +
  // fill data
  FILL_COMPONENTS;

const CORNER_DATA = new Float32Array([
  // x, y for 6 vertices making a quad
  -0.5, -0.5,
  +0.5, -0.5,
  +0.5, +0.5,
  -0.5, -0.5,
  +0.5, +0.5,
  -0.5, +0.5,
]);

export class InstancedParticlesRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly ext: InstancedArraysExt;

  private program: WebGLProgram | null = null;
  private cornerBuffer: WebGLBuffer | null = null;
  private instanceBuffer: WebGLBuffer | null = null;

  private attribs!: {
    a_corner: number;
    i_center: number;
    i_size: number;
    i_fillInfo: number;
    i_fillParams0: number;
    i_fillParams1: number;
    i_stopOffsets: number;
    i_stopColor0: number;
    i_stopColor1: number;
    i_stopColor2: number;
  };

  private uniforms!: {
    u_cameraPosition: WebGLUniformLocation;
    u_viewportSize: WebGLUniformLocation;
  };

  private instanceData: Float32Array = new Float32Array(0);
  private instanceCount = 0;

  private emitters = new Map<string, EmitterState>();
  private instances = new Map<string, SceneObjectInstance>();
  private lastTimestamp: number | null = null;

  constructor(gl: WebGLRenderingContext, ext: InstancedArraysExt) {
    this.gl = gl;
    this.ext = ext;
    this.setupGL();
  }

  public bootstrap(instances: readonly SceneObjectInstance[]): void {
    instances.forEach((instance) => this.tryRegisterEmitter(instance));
  }

  public applyChanges(changes: {
    added: SceneObjectInstance[];
    updated: SceneObjectInstance[];
    removed: string[];
  }): void {
    changes.removed.forEach((id) => {
      this.emitters.delete(id);
      this.instances.delete(id);
    });
    changes.added.forEach((instance) => this.tryRegisterEmitter(instance));
    changes.updated.forEach((instance) => this.tryRegisterEmitter(instance));
  }

  public update(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    const clampedDelta = Math.max(0, Math.min(deltaMs, MAX_DELTA_MS));
    const allParticles: number = this.advanceEmitters(clampedDelta);
    this.ensureInstanceCapacity(allParticles);
    this.writeInstanceBuffer();
    this.uploadInstanceData();
  }

  public render(camera: SceneCameraState): void {
    if (!this.program || this.instanceCount <= 0) {
      return;
    }
    const gl = this.gl;
    const ext = this.ext;
    gl.useProgram(this.program);
    gl.uniform2f(
      this.uniforms.u_cameraPosition,
      camera.position.x,
      camera.position.y
    );
    gl.uniform2f(
      this.uniforms.u_viewportSize,
      camera.viewportSize.width,
      camera.viewportSize.height
    );

    // Bind per-vertex corners
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.enableVertexAttribArray(this.attribs.a_corner);
    gl.vertexAttribPointer(this.attribs.a_corner, 2, gl.FLOAT, false, 0, 0);
    ext.vertexAttribDivisorANGLE(this.attribs.a_corner, 0);

    // Bind per-instance data
    const stride = INSTANCE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);

    let offset = 0;
    // i_center (2)
    gl.enableVertexAttribArray(this.attribs.i_center);
    gl.vertexAttribPointer(
      this.attribs.i_center,
      2,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_center, 1);
    offset += 2 * Float32Array.BYTES_PER_ELEMENT;
    // i_size (2)
    gl.enableVertexAttribArray(this.attribs.i_size);
    gl.vertexAttribPointer(
      this.attribs.i_size,
      2,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_size, 1);
    offset += 2 * Float32Array.BYTES_PER_ELEMENT;

    // i_fillInfo (4)
    gl.enableVertexAttribArray(this.attribs.i_fillInfo);
    gl.vertexAttribPointer(
      this.attribs.i_fillInfo,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_fillInfo, 1);
    offset += 4 * Float32Array.BYTES_PER_ELEMENT;
    // i_fillParams0 (4)
    gl.enableVertexAttribArray(this.attribs.i_fillParams0);
    gl.vertexAttribPointer(
      this.attribs.i_fillParams0,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_fillParams0, 1);
    offset += 4 * Float32Array.BYTES_PER_ELEMENT;
    // i_fillParams1 (4)
    gl.enableVertexAttribArray(this.attribs.i_fillParams1);
    gl.vertexAttribPointer(
      this.attribs.i_fillParams1,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_fillParams1, 1);
    offset += 4 * Float32Array.BYTES_PER_ELEMENT;
    // i_stopOffsets (3)
    gl.enableVertexAttribArray(this.attribs.i_stopOffsets);
    gl.vertexAttribPointer(
      this.attribs.i_stopOffsets,
      3,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_stopOffsets, 1);
    offset += 3 * Float32Array.BYTES_PER_ELEMENT;
    // i_stopColor0 (4)
    gl.enableVertexAttribArray(this.attribs.i_stopColor0);
    gl.vertexAttribPointer(
      this.attribs.i_stopColor0,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_stopColor0, 1);
    offset += 4 * Float32Array.BYTES_PER_ELEMENT;
    // i_stopColor1 (4)
    gl.enableVertexAttribArray(this.attribs.i_stopColor1);
    gl.vertexAttribPointer(
      this.attribs.i_stopColor1,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_stopColor1, 1);
    offset += 4 * Float32Array.BYTES_PER_ELEMENT;
    // i_stopColor2 (4)
    gl.enableVertexAttribArray(this.attribs.i_stopColor2);
    gl.vertexAttribPointer(
      this.attribs.i_stopColor2,
      4,
      gl.FLOAT,
      false,
      stride,
      offset
    );
    ext.vertexAttribDivisorANGLE(this.attribs.i_stopColor2, 1);
    // offset += 4 * Float32Array.BYTES_PER_ELEMENT; // not needed further

    ext.drawArraysInstancedANGLE(
      gl.TRIANGLES,
      0,
      VERTICES_PER_QUAD,
      this.instanceCount
    );
  }

  private setupGL(): void {
    const gl = this.gl;
    const vertexSource = `
attribute vec2 a_corner; // quad corner in [-0.5, 0.5]
attribute vec2 i_center;
attribute vec2 i_size; // full size (w, h)
attribute vec4 i_fillInfo;
attribute vec4 i_fillParams0;
attribute vec4 i_fillParams1;
attribute vec3 i_stopOffsets;
attribute vec4 i_stopColor0;
attribute vec4 i_stopColor1;
attribute vec4 i_stopColor2;
uniform vec2 u_cameraPosition;
uniform vec2 u_viewportSize;
varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

vec2 toClip(vec2 world) {
  vec2 normalized = (world - u_cameraPosition) / u_viewportSize;
  return vec2(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0);
}

// Local shader helpers (duplicate simplified versions from SceneScreen for isolation)
function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

void main() {
  vec2 world = i_center + a_corner * i_size; // no rotation for particles
  gl_Position = vec4(toClip(world), 0.0, 1.0);
  v_worldPosition = world;
  v_fillInfo = i_fillInfo;
  v_fillParams0 = i_fillParams0;
  v_fillParams1 = i_fillParams1;
  v_stopOffsets = i_stopOffsets;
  v_stopColor0 = i_stopColor0;
  v_stopColor1 = i_stopColor1;
  v_stopColor2 = i_stopColor2;
}
`;
    const fragmentSource = `
precision mediump float;
varying vec2 v_worldPosition;
varying vec4 v_fillInfo;
varying vec4 v_fillParams0;
varying vec4 v_fillParams1;
varying vec3 v_stopOffsets;
varying vec4 v_stopColor0;
varying vec4 v_stopColor1;
varying vec4 v_stopColor2;

float clamp01(float value) { return clamp(value, 0.0, 1.0); }

vec4 sampleGradient(float t) {
  float stopCount = v_fillInfo.y;
  vec4 color0 = v_stopColor0;
  if (stopCount < 1.5) {
    return color0;
  }
  float offset0 = v_stopOffsets.x;
  float offset1 = v_stopOffsets.y;
  vec4 color1 = v_stopColor1;
  if (stopCount < 2.5) {
    if (t <= offset0) return color0;
    if (t >= offset1) return color1;
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }
  float offset2 = v_stopOffsets.z;
  vec4 color2 = v_stopColor2;
  if (t <= offset0) return color0;
  if (t >= offset2) return color2;
  if (t <= offset1) {
    float range = max(offset1 - offset0, 0.0001);
    float factor = clamp((t - offset0) / range, 0.0, 1.0);
    return mix(color0, color1, factor);
  }
  float range = max(offset2 - offset1, 0.0001);
  float factor = clamp((t - offset1) / range, 0.0, 1.0);
  return mix(color1, color2, factor);
}

void main() {
  float fillType = v_fillInfo.x;
  vec4 color = v_stopColor0;
  if (fillType >= 0.5) {
    float t = 0.0;
    if (fillType < 1.5) {
      vec2 start = v_fillParams0.xy;
      vec2 dir = v_fillParams1.xy;
      float invLenSq = v_fillParams1.z;
      if (invLenSq > 0.0) {
        float projection = dot(v_worldPosition - start, dir) * invLenSq;
        t = clamp01(projection);
      }
    } else if (fillType < 2.5) {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      float dist = length(v_worldPosition - center);
      t = clamp01(dist / radius);
    } else {
      vec2 center = v_fillParams0.xy;
      float radius = max(v_fillParams0.z, 0.000001);
      vec2 diff = v_worldPosition - center;
      float dist = abs(diff.x) + abs(diff.y);
      t = clamp01(dist / radius);
    }
    color = sampleGradient(t);
  }
  gl_FragColor = color;
}
`;

    const vert = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const frag = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);
    this.program = this.createProgram(vert, frag);

    // Attributes
    this.attribs = {
      a_corner: gl.getAttribLocation(this.program, "a_corner"),
      i_center: gl.getAttribLocation(this.program, "i_center"),
      i_size: gl.getAttribLocation(this.program, "i_size"),
      i_fillInfo: gl.getAttribLocation(this.program, "i_fillInfo"),
      i_fillParams0: gl.getAttribLocation(this.program, "i_fillParams0"),
      i_fillParams1: gl.getAttribLocation(this.program, "i_fillParams1"),
      i_stopOffsets: gl.getAttribLocation(this.program, "i_stopOffsets"),
      i_stopColor0: gl.getAttribLocation(this.program, "i_stopColor0"),
      i_stopColor1: gl.getAttribLocation(this.program, "i_stopColor1"),
      i_stopColor2: gl.getAttribLocation(this.program, "i_stopColor2"),
    } as const;

    const cameraPos = gl.getUniformLocation(this.program, "u_cameraPosition");
    const viewportSize = gl.getUniformLocation(this.program, "u_viewportSize");
    if (!cameraPos || !viewportSize) {
      throw new Error("Unable to resolve instanced particle uniforms");
    }
    this.uniforms = {
      u_cameraPosition: cameraPos,
      u_viewportSize: viewportSize,
    } as const;

    // Buffers
    this.cornerBuffer = gl.createBuffer();
    this.instanceBuffer = gl.createBuffer();
    if (!this.cornerBuffer || !this.instanceBuffer) {
      throw new Error("Unable to create instanced buffers");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CORNER_DATA, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("Unable to create shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Unable to create program");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  private tryRegisterEmitter(instance: SceneObjectInstance): void {
    const custom = instance.data.customData as any;
    let cfg: EmitterConfigBase | null = null;
    if (instance.type === "playerUnit" && custom && custom.emitter) {
      const base = sanitizeParticleEmitterConfig(custom.emitter, {
        defaultColor: custom.baseFillColor || { r: 1, g: 1, b: 1, a: 1 },
        defaultOffset: { x: 0, y: 0 },
        minCapacity: 4,
      });
      if (base) {
        cfg = {
          ...base,
          baseSpeed: safeNum(custom.emitter.baseSpeed),
          speedVariation: safeNum(custom.emitter.speedVariation),
          spread: safeNum(custom.emitter.spread),
          physicalSize: safeNum(custom.physicalSize, 1),
        };
      }
    } else if (instance.type === "bullet" && custom && custom.tailEmitter) {
      const base = sanitizeParticleEmitterConfig(custom.tailEmitter, {
        defaultColor: { r: 1, g: 1, b: 1, a: 1 },
        defaultOffset: { x: -1, y: 0 },
        minCapacity: 4,
      });
      if (base) {
        cfg = {
          ...base,
          baseSpeed: safeNum(custom.tailEmitter.baseSpeed),
          speedVariation: safeNum(custom.tailEmitter.speedVariation),
          spread: safeNum(custom.tailEmitter.spread),
        };
      }
    } else if (instance.type === "explosion" && custom && custom.emitter) {
      // Custom data already contains sanitized in logic module; use as-is
      const base = sanitizeParticleEmitterConfig(custom.emitter, {
        defaultColor: { r: 1, g: 1, b: 1, a: 1 },
        minCapacity: 1,
      });
      if (base) {
        cfg = {
          ...base,
          baseSpeed: safeNum(custom.emitter.baseSpeed),
          speedVariation: safeNum(custom.emitter.speedVariation),
          spawnRadius: custom.emitter.spawnRadius,
          arc: custom.emitter.arc,
          direction: custom.emitter.direction,
        };
      }
    }

    // Always keep latest instance snapshot for origin/direction
    this.instances.set(instance.id, {
      id: instance.id,
      type: instance.type,
      data: {
        position: { x: instance.data.position.x, y: instance.data.position.y },
        size: instance.data.size ? { width: instance.data.size.width, height: instance.data.size.height } : undefined,
        color: instance.data.color ? { ...instance.data.color } : undefined,
        fill: instance.data.fill,
        rotation: typeof instance.data.rotation === "number" ? instance.data.rotation : undefined,
        stroke: instance.data.stroke ? { color: { ...instance.data.stroke.color }, width: instance.data.stroke.width } : undefined,
        customData: instance.data.customData,
      },
    });

    if (!cfg) {
      this.emitters.delete(instance.id);
      return;
    }

    const existing = this.emitters.get(instance.id);
    if (existing) {
      existing.config = cfg;
      return;
    }

    this.emitters.set(instance.id, {
      objectId: instance.id,
      config: cfg,
      particles: [],
      spawnAccumulator: 0,
      ageMs: 0,
    });
  }

  private advanceEmitters(deltaMs: number): number {
    let totalParticles = 0;
    const now = Date.now();
    const effectiveDelta = this.lastTimestamp ? Math.min(deltaMs, now - this.lastTimestamp) : deltaMs;
    this.lastTimestamp = now;

    this.emitters.forEach((emitter, id) => {
      const cfg = emitter.config;
      const rate = cfg.particlesPerSecond / 1000;
      const emissionDuration = getEmissionDuration(cfg);
      const prevAge = emitter.ageMs;
      emitter.ageMs = prevAge + effectiveDelta;
      const activeDelta = computeActiveDelta(prevAge, effectiveDelta, emissionDuration);

      if (activeDelta > 0 && rate > 0) {
        emitter.spawnAccumulator += rate * activeDelta;
      } else {
        emitter.spawnAccumulator = 0;
      }

      const origin = this.getOriginFor(id, cfg);
      const availableSlots = Math.max(0, cfg.capacity - emitter.particles.length);
      const spawnBudget = Math.min(Math.floor(emitter.spawnAccumulator), availableSlots);
      if (spawnBudget > 0) {
        for (let i = 0; i < spawnBudget; i += 1) {
          emitter.particles.push(this.spawnParticle(origin, id, cfg));
        }
        emitter.spawnAccumulator -= spawnBudget;
      }
      emitter.spawnAccumulator = Math.min(emitter.spawnAccumulator, cfg.capacity);

      // Update particles
      let write = 0;
      for (let read = 0; read < emitter.particles.length; read += 1) {
        const p = emitter.particles[read]!;
        if (!this.updateParticle(p, effectiveDelta, cfg)) {
          continue;
        }
        if (write !== read) {
          emitter.particles[write] = p;
        }
        write += 1;
      }
      if (write < emitter.particles.length) {
        emitter.particles.length = write;
      }

      totalParticles += emitter.particles.length;
    });

    return totalParticles;
  }

  private ensureInstanceCapacity(particles: number): void {
    const required = particles * INSTANCE_COMPONENTS;
    if (this.instanceData.length !== required) {
      this.instanceData = new Float32Array(required);
    }
    this.instanceCount = particles;
  }

  private writeInstanceBuffer(): void {
    const buffer = this.instanceData;
    if (buffer.length === 0) {
      return;
    }
    let offset = 0;
    const inactiveFill = writeFillVertexComponents(INACTIVE_PARTICLE_FILL, {
      fill: createSolidFill({ r: 1, g: 1, b: 1, a: 0 }),
      center: { x: 0, y: 0 },
      rotation: 0,
      size: { width: MIN_PARTICLE_SIZE, height: MIN_PARTICLE_SIZE },
      radius: MIN_PARTICLE_SIZE / 2,
    });
    applyParticleAlpha(inactiveFill, 0);

    this.emitters.forEach((emitter, id) => {
      const cfg = emitter.config;
      const fill = resolveParticleFill(cfg);
      for (let i = 0; i < emitter.particles.length; i += 1) {
        const p = emitter.particles[i]!;
        const size = Math.max(p.size, 0);
        const effectiveSize = Math.max(size, MIN_PARTICLE_SIZE);

        // center (2)
        buffer[offset++] = p.position.x;
        buffer[offset++] = p.position.y;
        // size (w,h)
        buffer[offset++] = effectiveSize;
        buffer[offset++] = effectiveSize;

        const fillComponents = writeFillVertexComponents(PARTICLE_FILL_SCRATCH, {
          fill,
          center: p.position,
          rotation: 0,
          size: { width: effectiveSize, height: effectiveSize },
          radius: effectiveSize / 2,
        });
        applyParticleAlpha(fillComponents, computeParticleAlpha(p, cfg));
        // copy fill components inline
        for (let j = 0; j < FILL_COMPONENTS; j += 1) {
          buffer[offset++] = fillComponents[j] ?? 0;
        }
      }
    });
  }

  private uploadInstanceData(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData, gl.DYNAMIC_DRAW);
  }

  private getOriginFor(objectId: string, cfg: EmitterConfigBase): SceneVector2 {
    const inst = this.instances.get(objectId);
    if (!inst) {
      return { x: cfg.offset.x, y: cfg.offset.y };
    }
    const rotation = inst.data.rotation;
    let offset = cfg.offset;
    if (inst.type === "playerUnit") {
      const scale = Math.max(1, cfg.physicalSize ?? 1);
      offset = { x: offset.x * scale, y: offset.y * scale };
    } else if (inst.type === "bullet") {
      const size = inst.data.size;
      const radius = size ? Math.max(size.width, size.height) / 2 : 0;
      offset = { x: offset.x * radius, y: offset.y * radius };
    }
    // transformObjectPoint logic inline (to avoid circular import):
    const center = inst.data.position;
    const angle = typeof rotation === "number" ? rotation : 0;
    if (angle === 0) {
      return { x: center.x + offset.x, y: center.y + offset.y };
    }
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center.x + offset.x * cos - offset.y * sin,
      y: center.y + offset.x * sin + offset.y * cos,
    };
  }

  private spawnParticle(origin: SceneVector2, objectId: string, cfg: EmitterConfigBase): ParticleEmitterParticleState {
    // Default: directional spread or explosion arc.
    // For player units and bullets, align with instance rotation + PI.
    const inst = this.instances.get(objectId);
    let baseDirection = cfg.direction ?? 0;
    if (inst && (inst.type === "playerUnit" || inst.type === "bullet")) {
      baseDirection = ((inst.data.rotation ?? 0) + Math.PI);
    }
    let finalDirection = baseDirection;
    if (typeof cfg.arc === "number" && cfg.arc > 0) {
      const half = cfg.arc / 2;
      finalDirection = baseDirection + (Math.random() * cfg.arc - half);
    } else if (typeof cfg.spread === "number" && cfg.spread > 0) {
      const half = cfg.spread / 2;
      finalDirection = baseDirection + (Math.random() * cfg.spread - half);
    }

    const baseSpeed = Math.max(0, cfg.baseSpeed ?? 0);
    const speedVar = Math.max(0, cfg.speedVariation ?? 0);
    const speed = Math.max(0, baseSpeed + (speedVar > 0 ? (Math.random() * 2 - 1) * speedVar : 0));

    let spawnOffsetX = 0;
    let spawnOffsetY = 0;
    if (cfg.spawnRadius) {
      const r = randomBetween(cfg.spawnRadius.min, cfg.spawnRadius.max);
      const angle = typeof cfg.arc === "number" && cfg.arc > 0
        ? (cfg.direction ?? 0) + (Math.random() * cfg.arc - cfg.arc / 2)
        : finalDirection;
      spawnOffsetX = Math.cos(angle) * r;
      spawnOffsetY = Math.sin(angle) * r;
    }

    const size = cfg.sizeRange.min === cfg.sizeRange.max
      ? cfg.sizeRange.min
      : randomBetween(cfg.sizeRange.min, cfg.sizeRange.max);

    return {
      position: { x: origin.x + spawnOffsetX, y: origin.y + spawnOffsetY },
      velocity: { x: Math.cos(finalDirection) * speed, y: Math.sin(finalDirection) * speed },
      ageMs: 0,
      lifetimeMs: cfg.particleLifetimeMs,
      size,
    };
  }

  private updateParticle(p: ParticleEmitterParticleState, deltaMs: number, cfg: EmitterConfigBase): boolean {
    p.ageMs += deltaMs;
    if (p.ageMs >= p.lifetimeMs) {
      return false;
    }
    p.position.x += p.velocity.x * deltaMs;
    p.position.y += p.velocity.y * deltaMs;
    return true;
  }
}

const getEmissionDuration = (config: ParticleEmitterBaseConfig): number => {
  const duration = config.emissionDurationMs;
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return Number.POSITIVE_INFINITY;
  }
  if (duration <= 0) {
    return 0;
  }
  return duration;
};

const computeActiveDelta = (
  previousAge: number,
  deltaMs: number,
  emissionDuration: number
): number => {
  if (!Number.isFinite(emissionDuration)) {
    return deltaMs;
  }
  if (emissionDuration <= previousAge) {
    return 0;
  }
  const available = emissionDuration - previousAge;
  if (available <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(deltaMs, available));
};

const computeParticleAlpha = (
  particle: ParticleEmitterParticleState,
  config: ParticleEmitterBaseConfig
): number => {
  if (config.fadeStartMs >= particle.lifetimeMs) {
    return 1;
  }
  if (particle.ageMs <= config.fadeStartMs) {
    return 1;
  }
  const fadeDuration = Math.max(1, particle.lifetimeMs - config.fadeStartMs);
  const fadeProgress = clamp01((particle.ageMs - config.fadeStartMs) / fadeDuration);
  return 1 - fadeProgress;
};

const applyParticleAlpha = (components: Float32Array, alpha: number): void => {
  const effectiveAlpha = clamp01(alpha);
  if (effectiveAlpha >= 1) {
    return;
  }
  const colorsOffset =
    4 +
    FILL_PARAMS0_COMPONENTS +
    FILL_PARAMS1_COMPONENTS +
    STOP_OFFSETS_COMPONENTS;
  for (let i = 0; i < MAX_GRADIENT_STOPS; i += 1) {
    const base = colorsOffset + i * STOP_COLOR_COMPONENTS;
    const alphaIndex = base + 3;
    if (alphaIndex < components.length) {
      const current = components[alphaIndex] ?? 0;
      components[alphaIndex] = current * effectiveAlpha;
    }
  }
};

const createSolidFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: color.r,
    g: color.g,
    b: color.b,
    a: typeof color.a === "number" ? color.a : 1,
  },
});

const createCircularFill = (color: SceneColor): SceneFill => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  stops: [
    { offset: 0, color: { r: color.r, g: color.g, b: color.b, a: typeof color.a === "number" ? color.a : 1 } },
    { offset: 1, color: { r: color.r, g: color.g, b: color.b, a: 0 } },
  ],
});

const resolveParticleFill = (config: ParticleEmitterBaseConfig): SceneFill => {
  const shape = config.shape === "circle" ? "circle" : "square";
  if (config.fill) {
    return config.fill;
  }
  if (shape === "circle") {
    return createCircularFill(config.color);
  }
  return createSolidFill(config.color);
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

const safeNum = (value: any, fallback = 0): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};


