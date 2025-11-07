import type { ExplosionRendererEmitterConfig } from "../../../db/explosions-db";
import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  SceneObjectInstance,
  SceneVector2,
  SceneFill,
  SceneColor,
  FILL_TYPES,
} from "../../../logic/services/SceneObjectManager";
import { createParticleEmitterPrimitive } from "../primitives";
import { getParticleEmitterGlContext } from "../primitives/utils/gpuContext";
import { sanitizeSceneColor } from "../../../logic/services/particles/ParticleEmitterShared";
import {
  WaveUniformConfig,
  ensureWaveBatch,
  getWaveBatch,
  writeWaveInstance,
  setWaveBatchActiveCount,
} from "../primitives/gpu/ExplosionWaveGpuRenderer";
import {
  normalizeAngle,
  sanitizeAngle,
  sanitizeArc,
} from "../../../logic/services/particles/ParticleEmitterShared";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";

interface ExplosionRendererCustomData {
  emitter?: ExplosionRendererEmitterConfig;
}

type ExplosionEmitterRenderConfig = ParticleEmitterBaseConfig & {
  baseSpeed: number;
  speedVariation: number;
  spawnRadius: { min: number; max: number };
  arc: number;
  direction: number;
};

const DEFAULT_COLOR = { r: 1, g: 1, b: 1, a: 1 } as const;

const createExplosionEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<ExplosionEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createExplosionParticle,
    serializeConfig: serializeExplosionEmitterConfig,
  });

const getEmitterConfig = (
  instance: SceneObjectInstance
): ExplosionEmitterRenderConfig | null => {
  const data = instance.data.customData as ExplosionRendererCustomData | undefined;
  if (!data || typeof data !== "object" || !data.emitter) {
    return null;
  }
  return sanitizeExplosionEmitterConfig(data.emitter);
};

const sanitizeExplosionEmitterConfig = (
  config: ExplosionRendererEmitterConfig
): ExplosionEmitterRenderConfig | null => {
  const base = sanitizeParticleEmitterConfig(
    {
      particlesPerSecond: config.particlesPerSecond,
      particleLifetimeMs: config.particleLifetimeMs,
      fadeStartMs: config.fadeStartMs,
      emissionDurationMs: config.emissionDurationMs,
      sizeRange: config.sizeRange,
      offset: config.offset,
      color: config.color,
      fill: config.fill,
      maxParticles: config.maxParticles,
    },
    { defaultColor: DEFAULT_COLOR, minCapacity: 1 }
  );

  if (!base) {
    return null;
  }

  const spawnMin = Math.max(0, config.spawnRadius.min);
  const spawnMax = Math.max(spawnMin, config.spawnRadius.max);

  return {
    ...base,
    baseSpeed: Math.max(0, config.baseSpeed),
    speedVariation: Math.max(0, config.speedVariation),
    spawnRadius: { min: spawnMin, max: spawnMax },
    arc: sanitizeArc(config.arc),
    direction: sanitizeAngle(config.direction),
  };
};

const serializeExplosionEmitterConfig = (
  config: ExplosionEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.emissionDurationMs ?? 0,
    config.sizeRange.min,
    config.sizeRange.max,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    config.color.a,
    config.capacity,
    config.baseSpeed,
    config.speedVariation,
    config.spawnRadius.min,
    config.spawnRadius.max,
    config.arc,
    config.direction,
    serializedFill,
    config.shape,
  ].join(":");
};

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): SceneVector2 => {
  const offset = config.offset ?? { x: 0, y: 0 };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const createExplosionParticle = (
  origin: SceneVector2,
  _instance: SceneObjectInstance,
  config: ExplosionEmitterRenderConfig
): ParticleEmitterParticleState => {
  const direction = pickParticleDirection(config);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const spawnRadius = randomBetween(config.spawnRadius.min, config.spawnRadius.max);
  const spawnAngle = pickSpawnAngle(config, direction);
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: {
      x: origin.x + Math.cos(spawnAngle) * spawnRadius,
      y: origin.y + Math.sin(spawnAngle) * spawnRadius,
    },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

const pickParticleDirection = (
  config: ExplosionEmitterRenderConfig
): number => {
  const arc = Math.max(0, config.arc);
  if (arc === 0) {
    return config.direction;
  }
  if (arc >= Math.PI * 2 - 1e-6) {
    return Math.random() * Math.PI * 2;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(config.direction + offset);
};

const pickSpawnAngle = (
  config: ExplosionEmitterRenderConfig,
  direction: number
): number => {
  const arc = Math.max(0, config.arc);
  if (arc === 0) {
    return direction;
  }
  if (arc >= Math.PI * 2 - 1e-6) {
    return Math.random() * Math.PI * 2;
  }
  const halfArc = arc / 2;
  const offset = Math.random() * arc - halfArc;
  return normalizeAngle(config.direction + offset);
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

export class ExplosionObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const dynamicPrimitives: DynamicPrimitive[] = [];
    
    const emitterPrimitive = createExplosionEmitterPrimitive(instance);
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    // GPU wave ring primitive (lazy init to avoid races with GL context availability)
    {
      let batch: ReturnType<typeof ensureWaveBatch> | null = null;
      let fillKeyCached: string | null = null;
      let slotIndex = -1;
      let age = 0;
      const lifetime = 800;
      let lastTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      dynamicPrimitives.push({
        data: new Float32Array(0),
        update(target) {
          // Acquire GL and batch lazily
          if (!batch) {
            const gl = getParticleEmitterGlContext();
            if (gl) {
              const fill = (target.data.fill as SceneFill) ?? ({ fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } as SceneColor } as any);
              const { uniforms, key: fillKey } = toWaveUniformsFromFill(fill);
              uniforms.hasExplicitRadius = false;
              uniforms.explicitRadius = 0;
              const DEFAULT_CAPACITY = 64;
              batch = ensureWaveBatch(gl, fillKey, DEFAULT_CAPACITY, uniforms);
              fillKeyCached = batch ? fillKey : null;
            }
            if (!batch) {
              return null;
            }
          }

          // If fill changed to a different batching key (unlikely), re-acquire batch
          const currentFill = (target.data.fill as SceneFill) ?? ({ fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 1 } as SceneColor } as any);
          const { key: currentKey } = toWaveUniformsFromFill(currentFill);
          if (fillKeyCached && currentKey !== fillKeyCached) {
            // Deactivate previous slot in the old batch before switching
            if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
              writeWaveInstance(batch, slotIndex, {
                position: { x: 0, y: 0 },
                size: 0,
                age: 0,
                lifetime: 0,
                active: false,
              });
              let activeCount = 0;
              for (let i = 0; i < batch.capacity; i += 1) {
                const inst = batch.instances[i];
                if (inst && inst.active) activeCount += 1;
              }
              setWaveBatchActiveCount(batch, activeCount);
            }
            const gl = getParticleEmitterGlContext();
            if (gl) {
              const { uniforms } = toWaveUniformsFromFill(currentFill);
              uniforms.hasExplicitRadius = false;
              uniforms.explicitRadius = 0;
              const DEFAULT_CAPACITY = 64;
              const next = ensureWaveBatch(gl, currentKey, DEFAULT_CAPACITY, uniforms);
              if (next) {
                batch = next;
                fillKeyCached = currentKey;
                slotIndex = -1;
                age = 0;
                lastTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
              }
            }
          }

          const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
          const dt = Math.max(0, Math.min(now - lastTs, 100));
          lastTs = now;
          age = Math.min(lifetime, age + dt);

          if (slotIndex < 0) {
            for (let i = 0; i < batch.capacity; i += 1) {
              if (!batch.instances[i] || !batch.instances[i]!.active) {
                slotIndex = i;
                break;
              }
            }
            if (slotIndex < 0) {
              slotIndex = 0;
            }
          }

          const radius = Math.max(0, Math.max(target.data.size?.width ?? 0, target.data.size?.height ?? 0) / 2);
          writeWaveInstance(batch, slotIndex, {
            position: target.data.position,
            size: radius * 2,
            age,
            lifetime,
            active: age < lifetime,
          });
          let activeCount = 0;
          for (let i = 0; i < batch.capacity; i += 1) {
            const inst = batch.instances[i];
            if (inst && inst.active) activeCount += 1;
          }
          setWaveBatchActiveCount(batch, activeCount);
          return null;
        },
        dispose() {
          if (batch && slotIndex >= 0 && slotIndex < batch.capacity) {
            writeWaveInstance(batch, slotIndex, {
              position: { x: 0, y: 0 },
              size: 0,
              age: 0,
              lifetime: 0,
              active: false,
            });
            let activeCount = 0;
            for (let i = 0; i < batch.capacity; i += 1) {
              const inst = batch.instances[i];
              if (inst && inst.active) activeCount += 1;
            }
            setWaveBatchActiveCount(batch, activeCount);
          }
          batch = null;
        },
      });
    }
    
    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const toWaveUniformsFromFill = (
  fill: SceneFill
): { uniforms: WaveUniformConfig; key: string } => {
  // Normalize batching key to avoid unique keys per radius/end value
  const key = JSON.stringify(
    fill.fillType === FILL_TYPES.SOLID
      ? {
          t: FILL_TYPES.SOLID,
          // RGB only; ignore alpha which changes frame-to-frame
          c: {
            r: (fill as any).color?.r ?? 1,
            g: (fill as any).color?.g ?? 1,
            b: (fill as any).color?.b ?? 1,
          },
        }
      : {
          t: fill.fillType,
          // ignore start/end (radius/offset), and ignore alpha; use only offsets + RGB
          stops: Array.isArray((fill as any).stops)
            ? (fill as any).stops.map((s: any) => ({
                o: s?.offset ?? 0,
                r: s?.color?.r ?? 1,
                g: s?.color?.g ?? 1,
                b: s?.color?.b ?? 1,
              }))
            : [],
        }
  );
  // Default SOLID white
  let fillType = FILL_TYPES.SOLID as number;
  const stopOffsets = new Float32Array([0, 1, 1]);
  const stopColor0 = new Float32Array([1, 1, 1, 1]);
  const stopColor1 = new Float32Array([1, 1, 1, 0]);
  const stopColor2 = new Float32Array([1, 1, 1, 0]);
  let stopCount = 1;
  let hasLinearStart = false;
  let hasLinearEnd = false;
  let hasRadialOffset = false;
  let hasExplicitRadius = false;
  let explicitRadius = 0;
  let linearStart: SceneVector2 | undefined;
  let linearEnd: SceneVector2 | undefined;
  let radialOffset: SceneVector2 | undefined;

  if (fill.fillType === FILL_TYPES.SOLID) {
    const color = sanitizeSceneColor((fill as any).color as any, { r: 1, g: 1, b: 1, a: 1 });
    stopColor0[0] = color.r; stopColor0[1] = color.g; stopColor0[2] = color.b; stopColor0[3] = color.a ?? 1;
    stopCount = 1;
    fillType = FILL_TYPES.SOLID;
  } else if (fill.fillType === FILL_TYPES.LINEAR_GRADIENT) {
    const f = fill as any;
    fillType = FILL_TYPES.LINEAR_GRADIENT;
    hasLinearStart = Boolean(f.start);
    hasLinearEnd = Boolean(f.end);
    if (f.start) linearStart = { x: f.start.x ?? 0, y: f.start.y ?? 0 };
    if (f.end) linearEnd = { x: f.end.x ?? 0, y: f.end.y ?? 0 };
    const stops = Array.isArray(f.stops) ? f.stops : [];
    stopCount = Math.min(3, Math.max(1, stops.length));
    const s0 = stops[0] ?? { offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } };
    const s1 = stops[1] ?? s0;
    const s2 = stops[2] ?? s1;
    stopOffsets[0] = Math.max(0, Math.min(1, s0.offset ?? 0));
    stopOffsets[1] = Math.max(0, Math.min(1, s1.offset ?? 1));
    stopOffsets[2] = Math.max(0, Math.min(1, s2.offset ?? 1));
    const c0 = sanitizeSceneColor(s0.color, { r: 1, g: 1, b: 1, a: 1 });
    const c1 = sanitizeSceneColor(s1.color, c0);
    const c2 = sanitizeSceneColor(s2.color, c1);
    stopColor0.set([c0.r, c0.g, c0.b, c0.a ?? 1]);
    stopColor1.set([c1.r, c1.g, c1.b, c1.a ?? 1]);
    stopColor2.set([c2.r, c2.g, c2.b, c2.a ?? 1]);
  } else if (fill.fillType === FILL_TYPES.RADIAL_GRADIENT || fill.fillType === FILL_TYPES.DIAMOND_GRADIENT) {
    const f = fill as any;
    fillType = fill.fillType;
    hasRadialOffset = Boolean(f.start);
    if (f.start) radialOffset = { x: f.start.x ?? 0, y: f.start.y ?? 0 };
    hasExplicitRadius = typeof f.end === "number" && Number.isFinite(f.end) && f.end > 0;
    explicitRadius = hasExplicitRadius ? Number(f.end) : 0;
    const stops = Array.isArray(f.stops) ? f.stops : [];
    stopCount = Math.min(3, Math.max(1, stops.length));
    const s0 = stops[0] ?? { offset: 0, color: { r: 1, g: 1, b: 1, a: 1 } };
    const s1 = stops[1] ?? s0;
    const s2 = stops[2] ?? s1;
    stopOffsets[0] = Math.max(0, Math.min(1, s0.offset ?? 0));
    stopOffsets[1] = Math.max(0, Math.min(1, s1.offset ?? 1));
    stopOffsets[2] = Math.max(0, Math.min(1, s2.offset ?? 1));
    const c0 = sanitizeSceneColor(s0.color, { r: 1, g: 1, b: 1, a: 1 });
    const c1 = sanitizeSceneColor(s1.color, c0);
    const c2 = sanitizeSceneColor(s2.color, c1);
    stopColor0.set([c0.r, c0.g, c0.b, c0.a ?? 1]);
    stopColor1.set([c1.r, c1.g, c1.b, c1.a ?? 1]);
    stopColor2.set([c2.r, c2.g, c2.b, c2.a ?? 1]);
  }

  const noise = fill.noise;
  const noiseColorAmplitude = noise ? Math.max(0, Math.min(1, noise.colorAmplitude)) : 0;
  const noiseAlphaAmplitude = noise ? Math.max(0, Math.min(1, noise.alphaAmplitude)) : 0;
  const noiseScale = noise ? Math.max(noise.scale, 0.0001) : 1;

  const uniforms: WaveUniformConfig = {
    fillType,
    stopCount,
    stopOffsets,
    stopColor0,
    stopColor1,
    stopColor2,
    noiseColorAmplitude,
    noiseAlphaAmplitude,
    noiseScale,
    hasLinearStart,
    linearStart: linearStart ?? { x: 0, y: 0 },
    hasLinearEnd,
    linearEnd: linearEnd ?? { x: 0, y: 0 },
    hasRadialOffset,
    radialOffset: radialOffset ?? { x: 0, y: 0 },
    hasExplicitRadius,
    explicitRadius,
    fadeStartMs: 0,
    defaultLifetimeMs: 1000,
    lengthMultiplier: 1,
    alignToVelocity: false,
  };

  return { uniforms, key };
};
