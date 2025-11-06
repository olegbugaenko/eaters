import { ResourceAmountMap } from "../types/resources";
import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneVector2,
} from "../logic/services/SceneObjectManager";
import {
  BulletTailConfig,
  BulletTailEmitterConfig,
} from "./bullets-db";
import { SkillId } from "./skills-db";

export type SpellId = "magic-arrow" | "sand-storm" | "void-darts" | "ring-of-fire";

export type SpellType = "projectile" | "whirl" | "persistent-aoe";

export interface SpellUnlockRequirement {
  skillId: SkillId;
  level: number;
}

export interface SpellDamageConfig {
  min: number;
  max: number;
}

export type ProjectileShape = "circle" | "triangle";

export interface SpellProjectileConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  tail: BulletTailConfig;
  tailEmitter?: BulletTailEmitterConfig;
  spawnOffset?: SceneVector2;
  ringTrail?: SpellProjectileRingTrailConfig;
  count?: number; // Кількість проджектайлів (за замовчуванням 1)
  spreadAngle?: number; // Розльот в градусах (за замовчуванням 0)
  shape?: ProjectileShape; // Форма проджектайла (за замовчуванням "circle")
}

export interface SpellWhirlConfig {
  radius: number;
  speed: number;
  damagePerSecond: number;
  maxHealth: number;
  spinSpeed?: number;
  // Візуальні параметри
  rotationSpeedMultiplier?: number; // Множник швидкості обертання (за замовчуванням 1.0)
  spiralArms?: number; // Кількість основних спіральних рукавів (за замовчуванням 6.0)
  spiralArms2?: number; // Кількість додаткових спіралей (за замовчуванням 12.0)
  spiralTwist?: number; // Множник закручення спіралей (за замовчуванням 7.0)
  spiralTwist2?: number; // Множник закручення додаткових спіралей (за замовчуванням 4.0)
  colorInner?: SceneColor; // Колір центру вихору (RGB)
  colorMid?: SceneColor; // Колір середини вихору (RGB)
  colorOuter?: SceneColor; // Колір краю вихору (RGB)
}

export interface SpellPersistentAoeRingConfig {
  shape: "ring";
  startRadius: number;
  endRadius: number;
  thickness: number;
}

export interface SpellPersistentAoeParticleEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  sizeRange: { min: number; max: number };
  color: SceneColor;
  fill?: SceneFill;
  maxParticles?: number;
  radialSpeed: { min: number; max: number };
  tangentialSpeed: { min: number; max: number };
  spawnJitter?: { radial?: number; angular?: number };
}

export interface SpellPersistentAoeVisualConfig {
  glowColor?: SceneColor;
  glowAlpha?: number;
  particleEmitter?: SpellPersistentAoeParticleEmitterConfig;
  fireColor?: SceneColor;
}

export interface SpellPersistentAoeConfig {
  durationMs: number;
  damagePerSecond: number;
  ring: SpellPersistentAoeRingConfig;
  visuals?: SpellPersistentAoeVisualConfig;
}

interface SpellBaseConfig {
  id: SpellId;
  name: string;
  description: string;
  cost: ResourceAmountMap;
  cooldownSeconds: number;
  unlock?: SpellUnlockRequirement | null;
}

export type SpellConfig =
  | (SpellBaseConfig & {
      type: "projectile";
      damage: SpellDamageConfig;
      projectile: SpellProjectileConfig;
    })
  | (SpellBaseConfig & {
      type: "whirl";
      whirl: SpellWhirlConfig;
    })
  | (SpellBaseConfig & {
      type: "persistent-aoe";
      persistentAoe: SpellPersistentAoeConfig;
    });

export interface SpellProjectileRingTrailConfig {
  spawnIntervalMs: number;
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  innerStop: number;
  outerStop: number;
  color: SceneColor;
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
  sizeRange: { min: 8.1, max: 23.4 },
  spread: Math.PI / 5,
  offset: { x: -1, y: 0 },
  color: { r: 0.55, g: 0.4, b: 1, a: 0.6 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    stops: [
      { offset: 0, color: { r: 0.55, g: 0.65, b: 1, a: 0.32 } },
      { offset: 1, color: { r: 0.6, g: 0.65, b: 0.65, a: 0 } },
    ],
  },
  maxParticles: 90,
};

const VOID_DARTS_TAIL_EMITTER: BulletTailEmitterConfig = {
  particlesPerSecond: 40,
  particleLifetimeMs: 920,
  fadeStartMs: 240,
  baseSpeed: 0.1,
  speedVariation: 0.1,
  sizeRange: { min: 4.1, max: 8.4 },
  spread: Math.PI / 8,
  offset: { x: -1, y: 0 },
  color: { r: 0.55, g: 0.4, b: 1, a: 0.05 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    stops: [
      { offset: 0, color: { r: 0.75, g: 0.8, b: 0.95, a: 0.08 } },
      { offset: 1, color: { r: 0.75, g: 1, b: 1, a: 0 } },
    ],
  },
  maxParticles: 290,
};

const SPELL_DB: Record<SpellId, SpellConfig> = {
  "magic-arrow": {
    id: "magic-arrow",
    type: "projectile",
    name: "Magic Arrow",
    description:
      "Launch a razor of focused mana that slices through the air toward your target.",
    cost: { mana: 1.0, sanity: 0.2 },
    cooldownSeconds: 0.75,
    damage: { min: 3, max: 4 },
    projectile: {
      radius: 4,
      speed: 230,
      lifetimeMs: 3_600,
      fill: MAGIC_ARROW_PROJECTILE_FILL,
      tail: MAGIC_ARROW_TAIL,
      tailEmitter: MAGIC_ARROW_TAIL_EMITTER,
      ringTrail: {
        spawnIntervalMs: 25,
        lifetimeMs: 900,
        startRadius: 4,
        endRadius: 35,
        startAlpha: 0.1,
        endAlpha: 0,
        innerStop: 0.48,
        outerStop: 0.78,
        color: { r: 0.5, g: 0.7, b: 1, a: 0.1 },
      },
    },
  },
  "sand-storm": {
    id: "sand-storm",
    type: "whirl",
    name: "Sand Storm",
    description:
      "Summon a whirling storm of scouring grit that grinds forward, shredding bricks until the vortex collapses.",
    cost: { mana: 5, sanity: 1 },
    cooldownSeconds: 2,
    whirl: {
      radius: 30,
      speed: 170,
      damagePerSecond: 5.0,
      maxHealth: 30,
      spinSpeed: 6.8,
      rotationSpeedMultiplier: 0.5,
      spiralArms: 6.0,
      spiralArms2: 12.0,
      spiralTwist: 7.0,
      spiralTwist2: 4.0,
      colorInner: { r: 0.95, g: 0.88, b: 0.72, a: 0.6 },
      colorMid: { r: 0.85, g: 0.72, b: 0.58, a: 0.5 },
      colorOuter: { r: 0.68, g: 0.55, b: 0.43, a: 0.4 },
    },
    unlock: { skillId: "sandstorm_ritual", level: 1 },
  },
  "void-darts": {
    id: "void-darts",
    type: "projectile",
    name: "Darts of the Void",
    description:
      "Unleash darts of metal and void energy that damage targets.",
    cost: { mana: 5.0, sanity: 1 },
    cooldownSeconds: 1.2,
    damage: { min: 3, max: 8 },
    projectile: {
      radius: 3,
      speed: 120,
      lifetimeMs: 12_500,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.7, g: 0.7, b: 0.75, a: 0.5 },
      },
      tail: {
        lengthMultiplier: 3,
        widthMultiplier: 1.2,
        startColor: { r: 0.35, g: 0.35, b: 0.4, a: 0.5 },
        endColor: { r: 0.2, g: 0.2, b: 0.25, a: 0 },
      },
      tailEmitter: VOID_DARTS_TAIL_EMITTER,
      ringTrail: {
        spawnIntervalMs: 50,
        lifetimeMs: 900,
        startRadius: 4,
        endRadius: 25,
        startAlpha: 0.05,
        endAlpha: 0,
        innerStop: 0.48,
        outerStop: 0.78,
        color: { r: 0.5, g: 0.7, b: 0.7, a: 0.05 },
      },
      count: 10,
      spreadAngle: 15,
      shape: "triangle",
    },
    unlock: { skillId: "black_darts", level: 1 },
  },
  "ring-of-fire": {
    id: "ring-of-fire",
    type: "persistent-aoe",
    name: "Ring of Fire",
    description:
      "Conjure an expanding crown of flame that scorches bricks as it races outward.",
    cost: { mana: 8, sanity: 1.5 },
    cooldownSeconds: 6,
    persistentAoe: {
      durationMs: 3_000,
      damagePerSecond: 10,
      ring: {
        shape: "ring",
        startRadius: 12,
        endRadius: 120,
        thickness: 30,
      },
      visuals: {
        glowColor: { r: 1, g: 0.46, b: 0.13, a: 0.4 },
        glowAlpha: 0.3,
        fireColor: { r: 1, g: 0.74, b: 0.54, a: 1 },
        particleEmitter: {
          particlesPerSecond: 2400,
          particleLifetimeMs: 650,
          fadeStartMs: 150,
          sizeRange: { min: 8, max: 18 },
          color: { r: 1, g: 0.62, b: 0.24, a: 0.95 },
          fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            end: 18,
            stops: [
              { offset: 0, color: { r: 1, g: 0.95, b: 0.75, a: 0.95 } },
              { offset: 0.55, color: { r: 1, g: 0.65, b: 0.25, a: 0.75 } },
              { offset: 1, color: { r: 0.95, g: 0.25, b: 0.05, a: 0 } },
            ],
          },
          radialSpeed: { min: 80, max: 150 },
          tangentialSpeed: { min: 40, max: 120 },
          spawnJitter: { radial: 8, angular: 0.25 },
          maxParticles: 2800,
        },
      },
    },
    unlock: { skillId: "ring_of_fire", level: 1 },
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
