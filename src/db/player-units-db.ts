import {
  FILL_TYPES,
  SceneColor,
  SceneFill,
  SceneVector2,
} from "../logic/services/SceneObjectManager";
import { ParticleEmitterShape } from "../logic/services/particles/ParticleEmitterShared";
import { ResourceCost } from "../types/resources";
import type { UnitModuleId } from "./unit-modules-db";
import type { SkillId } from "./skills-db";
import { mapLineToPolygonShape } from '../utils/paths';

export type PlayerUnitType = "bluePentagon";

export type PlayerUnitRendererFillConfig =
  | {
      type: "base";
      brightness?: number;
      alphaMultiplier?: number;
    }
  | {
      type: "solid";
      color: SceneColor;
    }
  | {
      type: "gradient";
      fill: SceneFill;
    };

export type PlayerUnitRendererStrokeConfig =
  | {
      type: "base";
      width: number;
      brightness?: number;
      alphaMultiplier?: number;
    }
  | {
      type: "solid";
      width: number;
      color: SceneColor;
    };

export type PlayerUnitRendererLayerConfig =
  | {
      shape: "polygon";
      vertices: readonly SceneVector2[];
      offset?: SceneVector2;
      fill?: PlayerUnitRendererFillConfig;
      stroke?: PlayerUnitRendererStrokeConfig;
      requiresModule?: UnitModuleId;
      requiresSkill?: SkillId;
      // Optional animation and meta for dynamic deformation
      anim?: {
        type: "sway" | "pulse";
        periodMs?: number;
        amplitude?: number;
        phase?: number;
        falloff?: "tip" | "root" | "none";
        axis?: "normal" | "tangent";
      };
      // Meta for line-based shapes (tentacles): original spine and builder opts
      spine?: { x: number; y: number; width: number }[];
      segmentIndex?: number;
      buildOpts?: { epsilon?: number; minSegmentLength?: number; winding?: "CW" | "CCW" };
      groupId?: string;
    }
  | {
      shape: "circle";
      radius: number;
      segments?: number;
      offset?: SceneVector2;
      fill?: PlayerUnitRendererFillConfig;
      stroke?: PlayerUnitRendererStrokeConfig;
      requiresModule?: UnitModuleId;
      requiresSkill?: SkillId;
      anim?: {
        type: "pulse" | "sway";
        periodMs?: number;
        amplitude?: number;
        phase?: number;
      };
      groupId?: string;
    };

export interface PlayerUnitRendererCompositeConfig {
  kind: "composite";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  layers: readonly PlayerUnitRendererLayerConfig[];
}

export type PlayerUnitRendererConfig = PlayerUnitRendererCompositeConfig;

export interface PlayerUnitEmitterConfig {
  particlesPerSecond: number;
  particleLifetimeMs: number;
  fadeStartMs: number;
  baseSpeed: number;
  speedVariation: number;
  sizeRange: { min: number; max: number };
  spread: number;
  offset: SceneVector2;
  color: SceneColor;
  fill?: SceneFill;
  shape?: ParticleEmitterShape;
  maxParticles?: number;
}

export interface PlayerUnitConfig {
  readonly name: string;
  readonly renderer: PlayerUnitRendererConfig;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseAttackDamage: number;
  readonly baseAttackInterval: number; // seconds
  readonly baseAttackDistance: number;
  readonly moveSpeed: number; // units per second
  readonly moveAcceleration: number; // force units per second^2 before mass
  readonly mass: number;
  readonly physicalSize: number;
  readonly baseCritChance?: number;
  readonly baseCritMultiplier?: number;
  readonly emitter?: PlayerUnitEmitterConfig;
  readonly cost: ResourceCost;
}

const DRILL_BODY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -22 },
  { x: 7.5, y: -11 },
  { x: 4.5, y: -3 },
  { x: 7.2, y: 2.5 },
  { x: 5.8, y: 18 },
  { x: -5.8, y: 18 },
  { x: -7.2, y: 2.5 },
  { x: -4.5, y: -3 },
  { x: -7.5, y: -11 },
];

const DRILL_SPIRAL_VERTICES: readonly SceneVector2[] = [
  { x: -2.3, y: -18.5 },
  { x: 1.8, y: -16.5 },
  { x: 4.6, y: -8.5 },
  { x: 0.6, y: -1.4 },
  { x: 3.6, y: 4.2 },
  { x: 0.4, y: 12.5 },
  { x: -3.5, y: 6.4 },
];

const DRILL_SHADOW_VERTICES: readonly SceneVector2[] = [
  { x: -5.8, y: -11 },
  { x: -3.4, y: -2.2 },
  { x: -6.2, y: 3.6 },
  { x: -4.8, y: 18 },
  { x: -8.2, y: 18 },
  { x: -9, y: 5.5 },
  { x: -8.4, y: -9.8 },
];

const DRILL_HANDLE_LEFT_VERTICES: readonly SceneVector2[] = [
  { x: -11.8, y: 4.5 },
  { x: -6.6, y: 4.5 },
  { x: -7.4, y: 13.8 },
  { x: -12.6, y: 13.8 },
];

const DRILL_HANDLE_RIGHT_VERTICES: readonly SceneVector2[] = [
  { x: 6.6, y: 4.5 },
  { x: 11.8, y: 4.5 },
  { x: 12.6, y: 13.8 },
  { x: 7.4, y: 13.8 },
];

const DRILL_TIP_GLEAM_VERTICES: readonly SceneVector2[] = [
  { x: -1.4, y: -20.5 },
  { x: 1.8, y: -18.2 },
  { x: -0.2, y: -13.6 },
  { x: -2.9, y: -15.8 },
];

const PLAYER_UNITS_DB: Record<PlayerUnitType, PlayerUnitConfig> = {
  bluePentagon: {
    name: "Blue Vanguard",
    renderer: {
      kind: "composite",
      fill: { r: 0.4, g: 0.8, b: 0.95, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 24,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 24,
              stops: [
                { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.75 } },
                { offset: 0.2, color: { r: 0.6, g: 0.85, b: 1, a: 0.25 } },
                { offset: 0.55, color: { r: 0.5, g: 0.8, b: 1, a: 0.09 } },
                { offset: 1, color: { r: 0.5, g: 0.75, b: 0.95, a: 0 } },
              ],
            },
          },
        },
        // Chord base (requires skill void_modules)
        {
          shape: "polygon",
          requiresSkill: "void_modules",
          vertices: [
            { x: -9, y: -2 },
            { x: 5, y: -1 },
            { x: 5, y: 1 },
            { x: -9, y: 2 },
          ],
          fill: { type: "base", brightness: -0.04 },
          stroke: { type: "base", width: 2.2, brightness: -0.04 },
        },
        // Chord spur (requires skill void_modules)
        {
          shape: "polygon",
          requiresSkill: "void_modules",
          vertices: [
            { x: 0, y: -4 },
            { x: 3, y: -4 },
            { x: 6, y: 0 },
            { x: 3, y: 4 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: -0.06 },
          stroke: { type: "base", width: 2.0, brightness: -0.06 },
        },
        // Tentacles

        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 2.4, y: 3.2, width: 1.6 }, {x: 4.9, y: 9.3, width: 0.7}, { x: 5, y: 12.5, width: 0.3}, { x: 7, y: 16, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 5.0, falloff: "tip", axis: "normal", phase: 0 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 4.6, y: 1.8, width: 1.6 }, {x: 8.2, y: 3.3, width: 0.7}, { x: 11, y: 7.5, width: 0.3}, { x: 15, y: 8, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 5, falloff: "tip", axis: "normal", phase: 0.4 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 4.6, y: -1.8, width: 1.6 }, {x: 8.2, y: -3.3, width: 0.7}, { x: 11, y: -7.5, width: 0.3}, { x: 15, y: -8, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 5.0, falloff: "tip", axis: "normal", phase: 0.7 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 2.4, y: -3.2, width: 1.6 }, {x: 4.9, y: -9.3, width: 0.7}, { x: 5, y: -12.5, width: 0.3}, { x: 7, y: -16, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 5, falloff: "tip", axis: "normal", phase: 1.1 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        {
          shape: "polygon",
          requiresModule: "ironForge",
          vertices: [
            {x: 11, y: 0},
            {x: 4, y: -2},
            {x: 4, y: 2},
          ],
          fill: { type: "base", brightness: -0.05 },
          stroke: { type: "base", width: 3.2, brightness: -0.05 },
        },
        {
          shape: "polygon",
          requiresModule: "vitalHull",
          vertices: [
            {x: -3, y: -2},
            {x: -6, y: -4},
            {x: -9, y: -2},
            {x: -9, y: 2},
            {x: -6, y: 4},
            {x: -3, y: 2},
          ],
          fill: { type: "base", brightness: -0.05 },
          stroke: { type: "base", width: 3.2, brightness: -0.05 },
        },

        // Верхній вусик (корінь + тіло + гачок)
        { shape: "polygon", requiresModule: "magnet",
          // коренева “подушка” на хорді (збільшена)
          vertices: [ {x: -1.2, y: 0.8}, {x: 1.4, y: 1.0}, {x: 1.4, y: 1.6}, {x: -1.2, y: 1.4} ],
          fill: { type: "base", brightness: -0.06 },
          stroke: { type: "base", width: 1.6, brightness: -0.10 }
        },
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          // тіло: довше й товстіше біля основи, помітніший силует
          [ {x: 1.2, y: 1.4, width: 2.2}, {x: 5.6, y: 3.4, width: 1.4}, {x: 9.8, y: 4.6, width: 0.8} ],
          { requiresModule: "magnet", fill: { type: "base", brightness: -0.10 }, stroke: { type: "base", width: 1.4, brightness: -0.12 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        // гачок на кінчику (малий трикутник, “зачеп” до центру)
        { shape: "polygon", requiresModule: "magnet",
          vertices: [ {x: 9.2, y: 4.3}, {x: 8.2, y: 4.9}, {x: 8.8, y: 3.7} ],
          fill: { type: "base", brightness: -0.05 },
          stroke: { type: "base", width: 1.1, brightness: -0.10 }
        },

        // Нижній вусик (корінь + тіло + гачок) — дзеркально вниз
        { shape: "polygon", requiresModule: "magnet",
          vertices: [ {x: -1.2, y: -0.8}, {x: 1.4, y: -1.0}, {x: 1.4, y: -1.6}, {x: -1.2, y: -1.4} ],
          fill: { type: "base", brightness: -0.06 },
          stroke: { type: "base", width: 1.6, brightness: -0.10 }
        },
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [ {x: 1.2, y: -1.4, width: 2.2}, {x: 5.6, y: -3.4, width: 1.4}, {x: 9.8, y: -4.6, width: 0.8} ],
          { requiresModule: "magnet", fill: { type: "base", brightness: -0.10 }, stroke: { type: "base", width: 1.4, brightness: -0.12 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        { shape: "polygon", requiresModule: "magnet",
          vertices: [ {x: 9.2, y: -4.3}, {x: 8.2, y: -4.9}, {x: 8.8, y: -3.7} ],
          fill: { type: "base", brightness: -0.05 },
          stroke: { type: "base", width: 1.1, brightness: -0.10 }
        },

        /*{
          shape: "polygon",
          vertices: [
            {x: 9, y: 0},
            {x: 1, y: 5},
            {x: 1, y: 3},
            {x: -4, y: 4},
            {x: -4, y: -4},
            {x: 1, y: -3},
            {x: 1, y: -5},
          ],
          fill: { type: "base", brightness: -0.05 },
          stroke: { type: "base", width: 3.2, brightness: -0.05 },
        },*/
      ],
    },
    maxHp: 10,
    armor: 1,
    baseAttackDamage: 2,
    baseAttackInterval: 0.6,
    baseAttackDistance: 5,
    moveSpeed: 140,
    moveAcceleration: 140,
    mass: 0.6,
    physicalSize: 12,
    baseCritChance: 0,
    baseCritMultiplier: 2,
    emitter: {
      particlesPerSecond: 60,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.05,
      speedVariation: 0.01,
      sizeRange: { min: 10.2, max: 13.4 },
      spread: Math.PI / 5.5,
      offset: { x: -0.35, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.2, g: 0.85, b: 0.95, a: 0.1 } },
          { offset: 0.25, color: { r: 0.2, g: 0.85, b: 0.95, a: 0.05 } },
          { offset: 1, color: { r: 0.2, g: 0.85, b: 0.95, a: 0 } },
        ],
      },
      shape: "circle",
      maxParticles: 60,
    },
    cost: {
      mana: 5,
      sanity: 2,
    },
  },
};

export const PLAYER_UNIT_TYPES = Object.keys(PLAYER_UNITS_DB) as PlayerUnitType[];

export const getPlayerUnitConfig = (type: PlayerUnitType): PlayerUnitConfig => {
  const config = PLAYER_UNITS_DB[type];
  if (!config) {
    throw new Error(`Unknown player unit type: ${type}`);
  }
  return config;
};

export const isPlayerUnitType = (value: unknown): value is PlayerUnitType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(PLAYER_UNITS_DB, value);
