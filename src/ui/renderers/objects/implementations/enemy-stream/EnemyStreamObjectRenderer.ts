import {
  createDynamicCirclePrimitive,
  createParticleEmitterPrimitive,
} from "../../../primitives";
import { sanitizeParticleEmitterConfig } from "../../../primitives/ParticleEmitterPrimitive";
import type { GpuSpawnConfig, ParticleEmitterParticleState } from "../../../primitives/ParticleEmitterPrimitive";
import {
  ObjectRenderer,
  getInstanceRenderPosition,
  transformObjectPoint,
  type DynamicPrimitive,
} from "../../ObjectRenderer";
import type {
  SceneObjectInstance,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { getNowMs } from "@shared/helpers/time.helper";
import { randomBetween } from "@shared/helpers/numbers.helper";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";
import type { EnemyStreamCustomData, StreamEmitterRenderConfig } from "./types";

const getStreamData = (
  instance: SceneObjectInstance,
): EnemyStreamCustomData | null => {
  const data = instance.data.customData as EnemyStreamCustomData | undefined;
  if (!data || typeof data.range !== "number" || !data.visual) {
    return null;
  }
  return data;
};

const clamp01 = (v: number): number => (v <= 0 ? 0 : v >= 1 ? 1 : v);

const getLifeAlpha = (data: EnemyStreamCustomData): number => {
  const ageMs = Math.max(0, getNowMs() - data.startedAtMs);
  return Math.max(Math.min(clamp01(ageMs / 60), clamp01((data.durationMs - ageMs) / 120)), 0.05);
};

const getSourceGlowRadius = (instance: SceneObjectInstance, mul: number): number => {
  const data = getStreamData(instance);
  if (!data) {
    return 10 * mul;
  }
  const alpha = getLifeAlpha(data);
  const flicker =
    1 +
    Math.sin(getNowMs() * 0.014 + data.seed) * 0.09 +
    Math.sin(getNowMs() * 0.023 + data.seed * 0.7) * 0.05;
  return data.visual.widthStart * mul * flicker * alpha;
};

// --- Emitter config cache (same pattern as bullet emitter.helpers.ts) ---

const emitterConfigsCache = new WeakMap<
  SceneObjectInstance,
  {
    source: readonly ParticleEmitterConfig[] | undefined;
    configs: StreamEmitterRenderConfig[];
  }
>();

const sanitizeStreamEmitterConfig = (
  config: ParticleEmitterConfig,
): StreamEmitterRenderConfig | null => {
  const base = sanitizeParticleEmitterConfig(config, {
    defaultOffset: { x: 0, y: 0 },
    defaultColor: { r: 1, g: 1, b: 1, a: 1 },
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(config.baseSpeed) ? Number(config.baseSpeed) : 0,
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(config.speedVariation) ? Number(config.speedVariation) : 0,
  );
  const spread = Math.max(0, Number.isFinite(config.spread) ? Number(config.spread) : 0);
  const spawnRadiusMin = Math.max(0, config.spawnRadius?.min ?? 0);
  const spawnRadiusMax = Math.max(spawnRadiusMin, config.spawnRadius?.max ?? spawnRadiusMin);

  let sizeGrowthRate = base.sizeGrowthRate ?? 1.0;
  if (
    typeof config.sizeEvolutionMult === "number" &&
    Number.isFinite(config.sizeEvolutionMult) &&
    config.sizeEvolutionMult > 0
  ) {
    const lifetimeSeconds = base.particleLifetimeMs / 1000;
    if (lifetimeSeconds > 0 && config.sizeEvolutionMult !== 1) {
      sizeGrowthRate = Math.pow(config.sizeEvolutionMult, 1 / lifetimeSeconds);
    }
  }

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    spawnRadiusMin,
    spawnRadiusMax,
    sizeGrowthRate,
  };
};

const getEmitterConfigs = (
  instance: SceneObjectInstance,
): StreamEmitterRenderConfig[] => {
  const data = instance.data.customData as EnemyStreamCustomData | undefined;
  const source = data?.flameEmitters;
  const cached = emitterConfigsCache.get(instance);
  if (cached && cached.source === source) {
    return cached.configs;
  }

  const entries = source
    ? source.filter((entry): entry is ParticleEmitterConfig => Boolean(entry))
    : [];
  const configs = entries
    .map((entry) => sanitizeStreamEmitterConfig(entry))
    .filter((entry): entry is StreamEmitterRenderConfig => Boolean(entry));

  emitterConfigsCache.set(instance, { source, configs });
  return configs;
};

const getEmitterConfigAt = (
  instance: SceneObjectInstance,
  index: number,
): StreamEmitterRenderConfig | null => {
  const configs = getEmitterConfigs(instance);
  return configs[index] ?? null;
};

const serializeConfig = (config: StreamEmitterRenderConfig): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.fadeInMs,
    config.emissionDurationMs ?? 0,
    config.baseSpeed,
    config.speedVariation,
    config.sizeRange.min,
    config.sizeRange.max,
    config.spawnRadiusMin,
    config.spawnRadiusMax,
    config.spread,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    config.color.a,
    config.capacity,
    serializedFill,
    config.shape,
  ].join(":");
};

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  _config: StreamEmitterRenderConfig,
): SceneVector2 => {
  return getInstanceRenderPosition(instance);
};

const createStreamParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: StreamEmitterRenderConfig,
): ParticleEmitterParticleState => {
  const baseDirection = instance.data.rotation ?? 0;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0),
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);
  const spawnRadius =
    config.spawnRadiusMin === config.spawnRadiusMax
      ? config.spawnRadiusMin
      : randomBetween(config.spawnRadiusMin, config.spawnRadiusMax);
  const spawnAngle = Math.random() * Math.PI * 2;

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

const getGpuSpawnConfig = (
  instance: SceneObjectInstance,
  config: StreamEmitterRenderConfig,
): GpuSpawnConfig => ({
  baseSpeed: config.baseSpeed,
  speedVariation: config.speedVariation,
  sizeMin: config.sizeRange.min,
  sizeMax: config.sizeRange.max,
  spawnRadiusMin: config.spawnRadiusMin,
  spawnRadiusMax: config.spawnRadiusMax,
  arc: 0,
  direction: instance.data.rotation ?? 0,
  spread: config.spread,
  radialVelocity: false,
});

const createEmitterPrimitive = (
  instance: SceneObjectInstance,
  getConfig: (instance: SceneObjectInstance) => StreamEmitterRenderConfig | null,
): DynamicPrimitive | null => {
  const primitive = createParticleEmitterPrimitive<StreamEmitterRenderConfig>(instance, {
    getConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createStreamParticle,
    serializeConfig,
    getGpuSpawnConfig,
  });
  if (primitive) {
    primitive.autoAnimate = true;
  }
  return primitive;
};

export class EnemyStreamObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance) {
    const data = getStreamData(instance);
    if (!data) {
      return { staticPrimitives: [], dynamicPrimitives: [] };
    }

    const vis = data.visual;
    const dynamicPrimitives: DynamicPrimitive[] = [];

    dynamicPrimitives.push(
      createDynamicCirclePrimitive(instance, {
        radius: vis.widthStart * 2.2,
        getRadius: (t) => getSourceGlowRadius(t, 2.2),
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          end: 1,
          stops: [
            { offset: 0, color: { ...vis.coreColor, a: 0.6 } },
            { offset: 0.4, color: { ...vis.color, a: 0.25 } },
            { offset: 1, color: { ...vis.edgeColor, a: 0 } },
          ],
        },
      }),
    );

    dynamicPrimitives.push(
      createDynamicCirclePrimitive(instance, {
        radius: vis.widthStart * 1.0,
        getRadius: (t) => getSourceGlowRadius(t, 1.0),
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          end: 1,
          stops: [
            { offset: 0, color: { ...vis.coreColor, a: 0.95 } },
            { offset: 0.5, color: { ...vis.coreColor, a: 0.5 } },
            { offset: 1, color: { ...vis.color, a: 0 } },
          ],
        },
      }),
    );

    for (let index = 0; index < 8; index += 1) {
      const emitter = createEmitterPrimitive(instance, (entry) =>
        getEmitterConfigAt(entry, index),
      );
      if (!emitter) {
        break;
      }
      dynamicPrimitives.push(emitter);
    }

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}
