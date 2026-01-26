import { ResourceAmountMap } from "@shared/types/resources";
import {
  SceneColor,
  SceneFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterConfig } from "../logic/interfaces/visuals/particle-emitters-config";
import { BulletTailConfig } from "./bullets-db";
import type { BulletSpriteName } from "../logic/services/bullet-render-bridge/bullet-sprites.const";
import { SkillId } from "./skills-db";
import { ExplosionType } from "./explosions-db";
import type { AttackSeriesConfig } from "@shared/types/attack-series.types";
import type { TargetType } from "../logic/modules/active-map/targeting/targeting.types";

export type SpellId =
  | "magic-arrow"
  | "sand-storm"
  | "void-darts"
  | "electric-shards"
  | "ring-of-fire"
  | "weaken-curse"
  | "magic-storm";

export type SpellType = "projectile" | "whirl" | "persistent-aoe" | "projectiles_rain";

export interface SpellUnlockRequirement {
  skillId: SkillId;
  level: number;
}

export interface SpellDamageConfig {
  min: number;
  max: number;
}

export type ProjectileShape = "circle" | "sprite";

export interface SpellProjectileWanderConfig {
  /** Time between direction adjustments in milliseconds. */
  intervalMs: number;
  /** Maximum deviation angle from the current direction in degrees. */
  angleRangeDeg: number;
}

export interface SpellProjectileChainConfig {
  radius: number;
  jumps: number;
  damageMultiplier: number;
}

export interface SpellProjectileConfig {
  radius: number;
  speed: number;
  lifetimeMs: number;
  fill: SceneFill;
  tail: BulletTailConfig;
  tailEmitter?: ParticleEmitterConfig;
  spawnOffset?: SceneVector2;
  ringTrail?: SpellProjectileRingTrailConfig;
  rotationSpinningDegPerSec?: number;
  count?: number; // Кількість проджектайлів (за замовчуванням 1)
  spreadAngle?: number; // Розльот в градусах (за замовчуванням 0)
  attackSeries?: AttackSeriesConfig;
  shape?: ProjectileShape; // Форма проджектайла (за замовчуванням "circle")
  spriteName?: BulletSpriteName; // Sprite name when shape === "sprite"
  targetTypes?: TargetType[];
  aoe?: { radius: number; splash: number };
  explosion?: ExplosionType; // Тип вибуху при влучанні (опціонально)
  wander?: SpellProjectileWanderConfig;
  chain?: SpellProjectileChainConfig;
  ignoreTargetsOnPath?: boolean;
}

export interface SpellWhirlConfig {
  radius: number;
  speed: number;
  damagePerSecond: number;
  maxHealth: number;
  targetTypes?: TargetType[];
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

export interface SpellBrickEffectTintConfig {
  color: SceneColor;
  intensity: number;
}

export type SpellPersistentAoeEffectConfig =
  | {
      type: "outgoing-damage-multiplier";
      durationMs: number;
      multiplier: number;
      tint?: SpellBrickEffectTintConfig;
    }
  | {
      type: "outgoing-damage-flat-reduction";
      durationMs: number;
      reductionValue: number; // Flat value to subtract from damage (typically spell power)
      tint?: SpellBrickEffectTintConfig;
    };


export interface SpellPersistentAoeVisualConfig {
  /** If set, spawns this explosion type instead of fire ring. Use for non-fire effects. */
  explosion?: ExplosionType;
  glowColor?: SceneColor;
  glowAlpha?: number;
  particleEmitter?: ParticleEmitterConfig;
  fireColor?: SceneColor;
}

export interface SpellPersistentAoeConfig {
  durationMs: number;
  damagePerSecond: number;
  ring: SpellPersistentAoeRingConfig;
  visuals?: SpellPersistentAoeVisualConfig;
  effects?: SpellPersistentAoeEffectConfig[];
  targetTypes?: TargetType[];
}

export type ProjectilesRainOrigin =
  | {
      type: "portal";
    }
  | {
      type: "absolute";
      position: SceneVector2;
    }
  | {
      type: "corner";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }
  | {
      type: "offset-from-target";
      offset: SceneVector2;
    }
  | {
      type: "corner-with-target-delta";
      corner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    }
  | {
      type: "corner-with-target-delta";
      cornerPosition: SceneVector2;
    };

export interface SpellProjectilesRainConfig {
  durationMs: number;
  spawnIntervalMs: number;
  radius: number;
  origin: ProjectilesRainOrigin;
  damage: SpellDamageConfig;
  projectile: SpellProjectileConfig;
  highlightArea?: {
    fill: SceneFill;
  };
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
    })
  | (SpellBaseConfig & {
      type: "projectiles_rain";
      projectilesRain: SpellProjectilesRainConfig;
    });

export interface SpellProjectileRingTrailConfig {
  spawnIntervalMs: number;
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  /** Optional fade-in duration in milliseconds (alpha ramps 0 -> full). */
  fadeInMs?: number;
  innerStop: number;
  outerStop: number;
  offset?: SceneVector2;
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
  startColor: { r: 0.55, g: 0.45, b: 1, a: 0.25 },
  endColor: { r: 0.15, g: 0.1, b: 0.55, a: 0 },
  offsetMultiplier: -0.95,
};

const MAGIC_ARROW_TAIL_EMITTER: ParticleEmitterConfig = {
  particlesPerSecond: 45,
  particleLifetimeMs: 1350,
  fadeStartMs: 540,
  baseSpeed: 0.05,
  speedVariation: 0.001,
  sizeRange: { min: 34.1, max: 46.4 },
  sizeEvolutionMult: 3.5, // Particles grow from 1x to 2x size over lifetime
  spread: Math.PI / 5,
  offset: { x: -2, y: 0 },
  color: { r: 0.55, g: 0.4, b: 1, a: 0.6 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    stops: [
      { offset: 0, color: { r: 0.55, g: 0.65, b: 1, a: 0.17 } },
      { offset: 1, color: { r: 0.6, g: 0.65, b: 0.65, a: 0.0 } },
    ],
    noise: {
      colorAmplitude: 0.0,
      alphaAmplitude: 0.02,
      scale: 0.35,
    },
  },
  maxParticles: 90,
};

const VOID_DARTS_TAIL_EMITTER: ParticleEmitterConfig = {
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

const ELECTRIC_SHARDS_TAIL_EMITTER: ParticleEmitterConfig = {
  particlesPerSecond: 260,
  particleLifetimeMs: 700,
  fadeStartMs: 220,
  baseSpeed: 0.18,
  speedVariation: 0.2,
  sizeRange: { min: 1.5, max: 3.2 },
  spread: 2*Math.PI,
  offset: { x: -1, y: 0 },
  color: { r: 0.35, g: 0.75, b: 1, a: 0.2 },
  shape: "triangle",
  fill: {
    fillType: FILL_TYPES.SOLID,
    color: { r: 0.85, g: 0.95, b: 1, a: 1 },
  },
  maxParticles: 300,
};

const MAGIC_STORM_PROJECTILE_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 14,
  stops: [
    { offset: 0, color: { r: 0.55, g: 0.7, b: 1, a: 0.85 } },
    { offset: 0.45, color: { r: 0.45, g: 0.45, b: 0.95, a: 0.55 } },
    { offset: 1, color: { r: 0.15, g: 0.2, b: 0.6, a: 0 } },
  ],
};

const MAGIC_STORM_HIGHLIGHT_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 150,
  stops: [
    { offset: 0, color: { r: 0.8, g: 0.35, b: 1, a: 0.05 } },
    { offset: 0.85, color: { r: 0.75, g: 0.25, b: 0.9, a: 0.25 } },
    { offset: 1, color: { r: 0.75, g: 0.25, b: 0.9, a: 0 } },
  ],
};

const SPELL_DB: Record<SpellId, SpellConfig> = {
  "magic-arrow": {
    id: "magic-arrow",
    type: "projectile",
    name: "Magic Arrow",
    description:
      "Launch a razor of focused mana that slices through the air toward your target.",
    cost: { mana: 1.0, sanity: 0 },
    cooldownSeconds: 0.75,
    damage: { min: 1, max: 3 },
    projectile: {
      radius: 12,
      shape: "sprite",
      spriteName: "magic_arrow",
      speed: 100,
      lifetimeMs: 19_600,
      fill: MAGIC_ARROW_PROJECTILE_FILL,
      tail: MAGIC_ARROW_TAIL,
      tailEmitter: MAGIC_ARROW_TAIL_EMITTER,
      ringTrail: {
        spawnIntervalMs: 45,
        lifetimeMs: 900,
        startRadius: 4,
        endRadius: 65,
        startAlpha: 0.1,
        endAlpha: 0,
        innerStop: 0.48,
        outerStop: 0.78,
        color: { r: 0.5, g: 0.7, b: 1, a: 0.5 },
      },
      aoe: { radius: 15, splash: 0.5 },
      explosion: "magnetic",
    },
  },
  "weaken-curse": {
    id: "weaken-curse",
    type: "persistent-aoe",
    name: "Weaken Curse",
    description:
      "Unfurl a rippling curse that saps the strength of bricks caught in its wave.",
    cost: { mana: 7, sanity: 0 },
    cooldownSeconds: 4,
    persistentAoe: {
      durationMs: 2_500,
      damagePerSecond: 0,
      ring: {
        shape: "ring",
        startRadius: 10,
        endRadius: 115,
        thickness: 26,
      },
      visuals: {
        explosion: "weakenCurse",
        glowColor: { r: 0.6, g: 0.52, b: 1, a: 0.55 },
        glowAlpha: 0.5,
      },
      effects: [
        {
          type: "outgoing-damage-flat-reduction",
          durationMs: 4_000,
          reductionValue: 0.75, // Will be multiplied by spell power when applied
          tint: { color: { r: 0.55, g: 0.45, b: 0.95, a: 1 }, intensity: 0.5 },
        },
      ],
    },
    unlock: { skillId: "weaken_curse", level: 1 },
  },
  "sand-storm": {
    id: "sand-storm",
    type: "whirl",
    name: "Sand Storm",
    description:
      "Summon a whirling storm of scouring grit that grinds forward, shredding bricks until the vortex collapses.",
    cost: { mana: 10, sanity: 0 },
    cooldownSeconds: 2,
    whirl: {
      radius: 30,
      speed: 170,
      damagePerSecond: 3.0,
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
    cost: { mana: 5.0, sanity: 0 },
    cooldownSeconds: 1.2,
    damage: { min: 1, max: 4 },
    projectile: {
      radius: 6,
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
      shape: "sprite",
      spriteName: "needle",
    },
    unlock: { skillId: "black_darts", level: 1 },
  },
  "electric-shards": {
    id: "electric-shards",
    type: "projectile",
    name: "Electric Shards",
    description:
      "Launch crackling shards that drift unpredictably and arc electricity between targets.",
    cost: { mana: 15, sanity: 0 },
    cooldownSeconds: 1.6,
    damage: { min: 4, max: 7 },
    projectile: {
      radius: 32,
      speed: 65,
      lifetimeMs: 16_500,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.6, g: 0.85, b: 1, a: 0.65 },
      },
      tail: {
        lengthMultiplier: 2.2,
        widthMultiplier: 1.0,
        taperMultiplier: 1,
        startColor: { r: 0.4, g: 0.7, b: 1, a: 0.1 },
        endColor: { r: 0.2, g: 0.45, b: 0.95, a: 0 },
      },
      tailEmitter: ELECTRIC_SHARDS_TAIL_EMITTER,
      rotationSpinningDegPerSec: 180,
      count: 4,
      spreadAngle: 18,
      shape: "sprite",
      spriteName: "electricity_orb",
      wander: {
        intervalMs: 920,
        angleRangeDeg: 18,
      },
      chain: {
        radius: 150,
        jumps: 3,
        damageMultiplier: 0.6,
      },
    },
    unlock: { skillId: "electric_shards", level: 1 },
  },
  "ring-of-fire": {
    id: "ring-of-fire",
    type: "persistent-aoe",
    name: "Ring of Fire",
    description:
      "Conjure an expanding crown of flame that scorches bricks as it races outward.",
    cost: { mana: 20, sanity: 0 },
    cooldownSeconds: 6,
    persistentAoe: {
      durationMs: 3_000,
      damagePerSecond: 8,
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
  "magic-storm": {
    id: "magic-storm",
    type: "projectiles_rain",
    name: "Magic Storm",
    description:
      "Open a rift above the battlefield, raining arcane bolts into a focused zone.",
    cost: { mana: 50, sanity: 0 },
    cooldownSeconds: 10,
    projectilesRain: {
      durationMs: 8_000,
      spawnIntervalMs: 400,
      radius: 150,
      origin: {
        type: "corner-with-target-delta",
        corner: "top-right",
      },
      damage: { min: 6, max: 9 },
      projectile: {
        radius: 32,
        speed: 160,
        lifetimeMs: 14_000,
        spriteName: "magic_raindrop",
        shape: "sprite",
        fill: MAGIC_STORM_PROJECTILE_FILL,
        tail: {
          lengthMultiplier: 3,
          widthMultiplier: 0.3,
          startColor: { r: 0.95, g: 0.6, b: 1, a: 0.25 },
          endColor: { r: 0.2, g: 0.25, b: 0.65, a: 0 },
        },
        ringTrail: {
          spawnIntervalMs: 45,
          lifetimeMs: 900,
          startRadius: 18,
          endRadius: 65,
          startAlpha: 0.1,
          endAlpha: 0,
          innerStop: 0.48,
          outerStop: 0.78,
          color: { r: 1, g: 0.7, b: 1, a: 0.5 },
          offset: { x: -1.5, y: 0 },
        },
        tailEmitter: {
          particlesPerSecond: 160,
          particleLifetimeMs: 900,
          fadeStartMs: 240,
          baseSpeed: 0.05,
          speedVariation: 0.0015,
          sizeRange: { min: 35.5, max: 42.4 },
          sizeEvolutionMult: 3.5,
          spread: Math.PI/3,
          offset: { x: -1.2, y: 0 },
          spawnRadius: { min: 0, max: 18 },
          color: { r: 0.9, g: 0.6, b: 1, a: 0.23 },
          fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            stops: [
              { offset: 0, color: { r: 0.7, g: 0.6, b: 1, a: 0.13 } },
              { offset: 0.5, color: { r: 0.7, g: 0.6, b: 1, a: 0.05 } },
              { offset: 1, color: { r: 0.7, g: 0.6, b: 1, a: 0.0 } },
            ],
            noise: {
              colorAmplitude: 0.0,
              alphaAmplitude: 0.01,
              scale: 0.35,
            },
          },
        },
        aoe: { radius: 55, splash: 1 },
        ignoreTargetsOnPath: true,
        explosion: "magicArrow",
      },
      highlightArea: {
        fill: MAGIC_STORM_HIGHLIGHT_FILL,
      },
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
