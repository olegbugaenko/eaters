import { ResourceAmountMap } from "../types/resources";
import {
  FILL_TYPES,
  SceneFill,
  SceneVector2,
} from "../logic/services/SceneObjectManager";
import {
  BulletTailConfig,
  BulletTailEmitterConfig,
} from "./bullets-db";

export type SpellId = "magic-arrow";

export interface SpellDamageConfig {
  min: number;
  max: number;
}

export interface SpellProjectileConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  tail: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
  spawnOffset?: SceneVector2;
}

export interface SpellConfig {
  id: SpellId;
  name: string;
  cost: ResourceAmountMap;
  cooldownSeconds: number;
  damage: SpellDamageConfig;
  projectile: SpellProjectileConfig;
}

const MAGIC_ARROW_PROJECTILE_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 9,
  stops: [
    { offset: 0, color: { r: 0.6, g: 0.7, b: 1, a: 1 } },
    { offset: 0.35, color: { r: 0.7, g: 0.55, b: 1, a: 0.85 } },
    { offset: 1, color: { r: 0.25, g: 0.1, b: 0.55, a: 0 } },
  ],
};

const MAGIC_ARROW_TAIL: BulletTailConfig = {
  lengthMultiplier: 5.5,
  widthMultiplier: 1.55,
  startColor: { r: 0.55, g: 0.45, b: 1, a: 0.65 },
  endColor: { r: 0.15, g: 0.1, b: 0.55, a: 0 },
};

const MAGIC_ARROW_TAIL_EMITTER: BulletTailEmitterConfig = {
  particlesPerSecond: 140,
  particleLifetimeMs: 520,
  fadeStartMs: 240,
  baseSpeed: 0.18,
  speedVariation: 0.05,
  sizeRange: { min: 1.1, max: 2.4 },
  spread: Math.PI / 5,
  offset: { x: -1, y: 0 },
  color: { r: 0.55, g: 0.4, b: 1, a: 0.6 },
  fill: {
    fillType: FILL_TYPES.LINEAR_GRADIENT,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    stops: [
      { offset: 0, color: { r: 0.55, g: 0.45, b: 1, a: 0.7 } },
      { offset: 1, color: { r: 0.1, g: 0.05, b: 0.45, a: 0 } },
    ],
  },
  maxParticles: 90,
};

const SPELL_DB: Record<SpellId, SpellConfig> = {
  "magic-arrow": {
    id: "magic-arrow",
    name: "Magic Arrow",
    cost: { mana: 0.5, sanity: 0.1 },
    cooldownSeconds: 1,
    damage: { min: 2, max: 4 },
    projectile: {
      radius: 9,
      speed: 520,
      lifetimeMs: 2_400,
      fill: MAGIC_ARROW_PROJECTILE_FILL,
      tail: MAGIC_ARROW_TAIL,
      tailEmitter: MAGIC_ARROW_TAIL_EMITTER,
    },
  },
};

export const SPELL_IDS = Object.keys(SPELL_DB) as SpellId[];

export const getSpellConfig = (id: SpellId): SpellConfig => {
  const config = SPELL_DB[id];
  if (!config) {
    throw new Error(`Unknown spell id: ${id}`);
  }
  return config;
};
