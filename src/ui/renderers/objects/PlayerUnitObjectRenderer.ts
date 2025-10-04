import {
  DynamicPrimitive,
  ObjectRegistration,
  ObjectRenderer,
  transformObjectPoint,
} from "./ObjectRenderer";
import {
  FILL_TYPES,
  SceneObjectInstance,
  SceneVector2,
  SceneStroke,
} from "../../../logic/services/SceneObjectManager";
import { createDynamicPolygonPrimitive, createParticleEmitterPrimitive } from "../primitives";
import {
  ParticleEmitterBaseConfig,
  ParticleEmitterParticleState,
  sanitizeParticleEmitterConfig,
} from "../primitives/ParticleEmitterPrimitive";
import type { PlayerUnitEmitterConfig } from "../../../db/player-units-db";

interface PlayerUnitRendererPayload {
  kind?: string;
  vertices?: SceneVector2[];
  offset?: SceneVector2;
}

interface PlayerUnitCustomData {
  renderer?: PlayerUnitRendererPayload;
  emitter?: PlayerUnitEmitterConfig;
  physicalSize?: number;
}

interface PlayerUnitEmitterRenderConfig extends ParticleEmitterBaseConfig {
  baseSpeed: number;
  speedVariation: number;
  spread: number;
  physicalSize: number;
}

const DEFAULT_VERTICES: SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 17, y: -6 },
  { x: 11, y: 16 },
  { x: -11, y: 16 },
  { x: -17, y: -6 },
];

const DEFAULT_EMITTER_COLOR = { r: 0.2, g: 0.45, b: 0.95, a: 0.5 };

const isVector = (value: unknown): value is SceneVector2 =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SceneVector2).x === "number" &&
  typeof (value as SceneVector2).y === "number";

const sanitizeVertices = (vertices: SceneVector2[] | undefined): SceneVector2[] => {
  if (!Array.isArray(vertices)) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  const sanitized = vertices
    .filter((vertex) => isVector(vertex))
    .map((vertex) => ({ x: vertex.x, y: vertex.y }));
  if (sanitized.length < 3) {
    return DEFAULT_VERTICES.map((vertex) => ({ ...vertex }));
  }
  return sanitized;
};

const sanitizeOffset = (offset: SceneVector2 | undefined): SceneVector2 | undefined => {
  if (!offset || !isVector(offset)) {
    return undefined;
  }
  return { x: offset.x, y: offset.y };
};

const extractRendererData = (
  instance: SceneObjectInstance
): { vertices: SceneVector2[]; offset?: SceneVector2 } => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (!payload || typeof payload !== "object") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  const renderer = payload.renderer;
  if (!renderer || renderer.kind !== "polygon") {
    return { vertices: DEFAULT_VERTICES.map((vertex) => ({ ...vertex })) };
  }
  return {
    vertices: sanitizeVertices(renderer.vertices),
    offset: sanitizeOffset(renderer.offset),
  };
};

const getEmitterConfig = (
  instance: SceneObjectInstance
): PlayerUnitEmitterRenderConfig | null => {
  const payload = instance.data.customData as PlayerUnitCustomData | undefined;
  if (!payload || typeof payload !== "object" || !payload.emitter) {
    return null;
  }

  const base = sanitizeParticleEmitterConfig(payload.emitter, {
    defaultColor: DEFAULT_EMITTER_COLOR,
    defaultOffset: { x: 0, y: 0 },
    minCapacity: 4,
  });
  if (!base) {
    return null;
  }

  const baseSpeed = Math.max(
    0,
    Number.isFinite(payload.emitter.baseSpeed)
      ? Number(payload.emitter.baseSpeed)
      : 0
  );
  const speedVariation = Math.max(
    0,
    Number.isFinite(payload.emitter.speedVariation)
      ? Number(payload.emitter.speedVariation)
      : 0
  );
  const spread = Math.max(
    0,
    Number.isFinite(payload.emitter.spread)
      ? Number(payload.emitter.spread)
      : 0
  );
  const physicalSize =
    typeof payload.physicalSize === "number" && Number.isFinite(payload.physicalSize)
      ? Math.max(payload.physicalSize, 0)
      : 0;

  return {
    ...base,
    baseSpeed,
    speedVariation,
    spread,
    physicalSize,
  };
};

const serializeEmitterConfig = (
  config: PlayerUnitEmitterRenderConfig
): string => {
  const serializedFill = config.fill ? JSON.stringify(config.fill) : "";
  return [
    config.particlesPerSecond,
    config.particleLifetimeMs,
    config.fadeStartMs,
    config.sizeRange.min,
    config.sizeRange.max,
    config.offset.x,
    config.offset.y,
    config.color.r,
    config.color.g,
    config.color.b,
    typeof config.color.a === "number" ? config.color.a : 1,
    config.emissionDurationMs ?? -1,
    config.capacity,
    config.baseSpeed,
    config.speedVariation,
    config.spread,
    config.physicalSize,
    serializedFill,
  ].join(":");
};

const createEmitterPrimitive = (
  instance: SceneObjectInstance
): DynamicPrimitive | null =>
  createParticleEmitterPrimitive<PlayerUnitEmitterRenderConfig>(instance, {
    getConfig: getEmitterConfig,
    getOrigin: getEmitterOrigin,
    spawnParticle: createEmitterParticle,
    serializeConfig: serializeEmitterConfig,
  });

const getEmitterOrigin = (
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): SceneVector2 => {
  const scale = Math.max(config.physicalSize, 1);
  const offset = {
    x: config.offset.x * scale,
    y: config.offset.y * scale,
  };
  return transformObjectPoint(instance.data.position, instance.data.rotation, offset);
};

const createEmitterParticle = (
  origin: SceneVector2,
  instance: SceneObjectInstance,
  config: PlayerUnitEmitterRenderConfig
): ParticleEmitterParticleState => {
  const baseDirection = (instance.data.rotation ?? 0) + Math.PI;
  const halfSpread = config.spread / 2;
  const direction =
    baseDirection + (config.spread > 0 ? randomBetween(-halfSpread, halfSpread) : 0);
  const speed = Math.max(
    0,
    config.baseSpeed +
      (config.speedVariation > 0
        ? randomBetween(-config.speedVariation, config.speedVariation)
        : 0)
  );
  const size =
    config.sizeRange.min === config.sizeRange.max
      ? config.sizeRange.min
      : randomBetween(config.sizeRange.min, config.sizeRange.max);

  return {
    position: { x: origin.x, y: origin.y },
    velocity: { x: Math.cos(direction) * speed, y: Math.sin(direction) * speed },
    ageMs: 0,
    lifetimeMs: config.particleLifetimeMs,
    size,
  };
};

const hasStroke = (stroke: SceneStroke | undefined): stroke is SceneStroke =>
  !!stroke && typeof stroke.width === "number" && stroke.width > 0;

export class PlayerUnitObjectRenderer extends ObjectRenderer {
  public register(instance: SceneObjectInstance): ObjectRegistration {
    const { vertices, offset } = extractRendererData(instance);

    const dynamicPrimitives: DynamicPrimitive[] = [];

    const emitterPrimitive = createEmitterPrimitive(instance);
    if (emitterPrimitive) {
      dynamicPrimitives.push(emitterPrimitive);
    }

    if (hasStroke(instance.data.stroke)) {
      const strokeVertices = expandVerticesForStroke(vertices, instance.data.stroke.width);
      const strokePrimitive = createDynamicPolygonPrimitive(instance, {
        vertices: strokeVertices,
        fill: createStrokeFill(instance.data.stroke),
        offset,
      });
      dynamicPrimitives.push(strokePrimitive);
    }

    dynamicPrimitives.push(
      createDynamicPolygonPrimitive(instance, {
        vertices,
        offset,
      })
    );

    return {
      staticPrimitives: [],
      dynamicPrimitives,
    };
  }
}

const createStrokeFill = (stroke: SceneStroke) => ({
  fillType: FILL_TYPES.SOLID,
  color: {
    r: stroke.color.r,
    g: stroke.color.g,
    b: stroke.color.b,
    a: typeof stroke.color.a === "number" ? stroke.color.a : 1,
  },
});

const expandVerticesForStroke = (vertices: SceneVector2[], strokeWidth: number) => {
  if (strokeWidth <= 0) {
    return vertices.map((vertex) => ({ ...vertex }));
  }

  const center = computeCenter(vertices);
  return vertices.map((vertex) => {
    const direction = {
      x: vertex.x - center.x,
      y: vertex.y - center.y,
    };
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) {
      return {
        x: vertex.x + strokeWidth,
        y: vertex.y,
      };
    }
    const scale = (length + strokeWidth) / Math.max(length, 1e-6);
    return {
      x: center.x + direction.x * scale,
      y: center.y + direction.y * scale,
    };
  });
};

const randomBetween = (min: number, max: number): number => {
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
};

const computeCenter = (vertices: SceneVector2[]): SceneVector2 => {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let minX = vertices[0]!.x;
  let maxX = vertices[0]!.x;
  let minY = vertices[0]!.y;
  let maxY = vertices[0]!.y;

  for (let i = 1; i < vertices.length; i += 1) {
    const vertex = vertices[i]!;
    if (vertex.x < minX) {
      minX = vertex.x;
    } else if (vertex.x > maxX) {
      maxX = vertex.x;
    }
    if (vertex.y < minY) {
      minY = vertex.y;
    } else if (vertex.y > maxY) {
      maxY = vertex.y;
    }
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
  };
};
