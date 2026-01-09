import {
  SceneColor,
  SceneFill,
  SceneSolidFill,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { ParticleEmitterConfig } from "../logic/interfaces/visuals/particle-emitters-config";
import { ResourceCost } from "@shared/types/resources";
import type { UnitModuleId } from "./unit-modules-db";
import { mapLineToPolygonShape } from '@shared/helpers/paths.helper';
import type { ExtendedRendererLayerFields, BaseRendererLayerConfig } from "@shared/types/renderer.types";

export type PlayerUnitType = "bluePentagon";

export interface PlayerUnitAuraConfig {
  petalCount: number;
  innerRadius: number;
  outerRadius: number;
  petalWidth?: number; // Ширина пелюстки (за замовчуванням використовується (outerRadius - innerRadius) * 0.5)
  rotationSpeed: number;
  color: SceneColor;
  alpha: number;
  requiresModule?: UnitModuleId;
  pointInward?: boolean; // Якщо true, пелюстки спрямовані всередину (загостренням до центру), інакше назовні (за замовчуванням false)
}

export type PlayerUnitRendererLayerConfig = BaseRendererLayerConfig<ExtendedRendererLayerFields>;

export interface PlayerUnitRendererCompositeConfig {
  kind: "composite";
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  layers: readonly PlayerUnitRendererLayerConfig[];
  auras?: readonly PlayerUnitAuraConfig[];
}

export type PlayerUnitRendererConfig = PlayerUnitRendererCompositeConfig;


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
  readonly emitter?: ParticleEmitterConfig;
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
      stroke: {
        color: { r: 0.55, g: 0.8, b: 0.95, a: 0.2 },
        width: 1.8,
      },
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
                { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.55 } },
                { offset: 0.2, color: { r: 0.6, g: 0.85, b: 1, a: 0.2 } },
                { offset: 0.55, color: { r: 0.5, g: 0.8, b: 1, a: 0.09 } },
                { offset: 1, color: { r: 0.5, g: 0.75, b: 0.95, a: 0 } },
              ],
            },
          },
        },
        // body
        {
          shape: "polygon",
          vertices: [
            { x: -14.4,  y:  0.0 },
            { x: -13.3,  y: -1.01 },
            { x: -12.3,  y: -1.57 },
            { x: -10.2,  y: -2.80 },
            { x:  -7.4,  y: -4.10 },
            { x:  -4.8,  y: -5.05 },
            { x:  -2.2,  y: -4.80 },
            { x:   0.9,  y: -5.95 },
            { x:   3.7,  y: -6.10 },
            { x:   6.0,  y: -4.97 },
            { x:   7.2,  y: -3.69 },
            { x:   8.0,  y: -2.90 },
            { x:   8.4,  y: -1.44 },
            { x:   8.7,  y:  0.0 },
          
            { x:   8.4,  y:  1.44 },
            { x:   8.0,  y:  2.90 },
            { x:   7.2,  y:  3.69 },
            { x:   6.0,  y:  4.97 },
            { x:   3.7,  y:  6.10 },
            { x:   0.9,  y:  5.95 },
            { x:  -2.2,  y:  4.80 },
            { x:  -4.8,  y:  5.05 },
            { x:  -7.4,  y:  4.10 },
            { x: -10.2,  y:  2.80 },
            { x: -12.3,  y:  1.57 },
            { x: -13.3,  y:  1.01 },
            { x: -14.4,  y:  0.0 },
          ],
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 12,
              stops: [
                { offset: 0, color: { r: 0.8, g: 0.9, b: 1, a: 0.0 } },
                { offset: 0.2, color: { r: 0.8, g: 0.9, b: 1, a: 0.0 } },
                { offset: 0.55, color: { r: 0.8, g: 0.9, b: 1, a: 0.05 } },
                { offset: 1, color: { r: 0.8, g: 0.9, b: 1, a: 0.15 } },
              ],
            },
          },
          stroke: { 
            type: "base", 
            width: 1.8,
          },
          anim: { type: "sway", periodMs: 1500, amplitudePercentage: 0.13, falloff: "tip", axis: "movement-tangent", phase: 0 }
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
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 8.0, falloff: "tip", axis: "normal", phase: 0 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 4.6, y: 1.8, width: 1.6 }, {x: 8.2, y: 3.3, width: 0.7}, { x: 11, y: 7.5, width: 0.3}, { x: 15, y: 8, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 8, falloff: "tip", axis: "normal", phase: 0.4 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 4.6, y: -1.8, width: 1.6 }, {x: 8.2, y: -3.3, width: 0.7}, { x: 11, y: -7.5, width: 0.3}, { x: 15, y: -8, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 8.0, falloff: "tip", axis: "normal", phase: 0.7 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [{ x: 2.4, y: -3.2, width: 1.6 }, {x: 4.9, y: -9.3, width: 0.7}, { x: 5, y: -12.5, width: 0.3}, { x: 7, y: -16, width: 0.2}],
          { requiresModule: "perforator", fill: { type: "base", brightness: -0.1 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 8, falloff: "tip", axis: "normal", phase: 1.1 } },
          { epsilon: 0.25, winding: "CCW" }
        ),
        {
          shape: "polygon",
          requiresModule: "ironForge",
          vertices: [
            {x: 15, y: 0},
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

        // Tail needles (long quills anchored at the chord tip)
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -7.6, y: 0.6 }, { x: -23.6, y: 3.4 }, { x: -8.4, y: 2.4 } ],
          fill: { type: "base", brightness: -0.1 },
          stroke: { type: "base", width: 1.25, brightness: -0.14 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -7.6, y: -0.6 }, { x: -23.6, y: -3.4 }, { x: -8.4, y: -2.4 } ],
          fill: { type: "base", brightness: -0.12 },
          stroke: { type: "base", width: 1.25, brightness: -0.16 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -7.8, y: 0.8 }, { x: -19.8, y: 7.6 }, { x: -8.4, y: 2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -7.8, y: -0.8 }, { x: -19.8, y: -7.6 }, { x: -8.4, y: -2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -6.3, y: 0.8 }, { x: -15.8, y: 10.6 }, { x: -7.4, y: 2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -6.3, y: -0.8 }, { x: -15.8, y: -10.6 }, { x: -7.4, y: -2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -5.3, y: 0.8 }, { x: -12.8, y: 11.6 }, { x: -6.4, y: 2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },
        { shape: "polygon", requiresModule: "tailNeedles",
          vertices: [ { x: -5.3, y: -0.8 }, { x: -12.8, y: -11.6 }, { x: -6.4, y: -2.2 } ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.74, g: 0.86, b: 0.95, a: 0.8 } } },
          stroke: { type: "base", width: 0.8, brightness: -0.12 },
        },

        // Burning tail (flame spine + glow)
        {
          shape: "polygon",
          requiresModule: "burningTail",
          // Коренева накладка — плавне продовження хорди вліво
          vertices: [
            { x: -9.0, y: -1.0 },
            { x: -13.0, y: -1.0 },
            { x: -16.8, y: -0.6 },
            { x: -19.8, y: -0.3 },
            { x: -19.8, y: 0.3 },
            { x: -16.8, y: 0.6 },
            { x: -13.0, y: 1.0 },
            { x: -9.0, y: 1.0 },
          ],
          fill: { type: "base", brightness: -0.06 },
          stroke: { type: "base", width: 1.0, brightness: -0.08 },
        },
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [
            { x: -18.6, y: 0.2, width: 2.2 },
            { x: -26.8, y: 0.7, width: 1.3 },
            { x: -34.4, y: 0.1, width: 0.6 },
          ],
          {
            requiresModule: "burningTail",
            fill: { type: "base", brightness: -0.08 },
            stroke: { type: "base", width: 0.8, brightness: -0.14 },
            anim: { type: "sway", periodMs: 1650, amplitude: 5.3, falloff: "tip", axis: "normal", phase: 0.12 },
            groupId: "burningTail-main",
          },
          { epsilon: 0.28, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [
            { x: -31.2, y: -0.2, width: 1.1 },
            { x: -35.0, y: -1.2, width: 0.7 },
          ],
          {
            requiresModule: "burningTail",
            fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 0.6, b: 0.24, a: 0.75 } } },
            anim: { type: "sway", periodMs: 1650, amplitude: 5.6, falloff: "tip", axis: "normal", phase: 0.42 },
            groupId: "burningTail-glow",
          },
          { epsilon: 0.2, winding: "CCW" }
        ),
        {
          shape: "polygon",
          requiresModule: "burningTail",
          vertices: [
            { x: -34.4, y: -1.3 },
            { x: -38.2, y: -0.7 },
            { x: -33.8, y: -0.2 },
            { x: -31.0, y: -0.7 },
          ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 0.58, b: 0.2, a: 0.85 } } },
          stroke: { type: "solid", width: 0.6, color: { r: 0.75, g: 0.22, b: 0.05, a: 1 } },
        },
        {
          shape: "circle",
          requiresModule: "burningTail",
          radius: 22,
          offset: { x: -36.6, y: -1.4 },
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 1, g: 0.7, b: 0.25, a: 0.65 } },
                { offset: 0.55, color: { r: 1, g: 0.42, b: 0.12, a: 0.35 } },
                { offset: 1, color: { r: 1, g: 0.2, b: 0.05, a: 0 } },
              ],
            },
          },
        },

        // Freezing tail (crystal spine + glow)
        {
          shape: "polygon",
          requiresModule: "freezingTail",
          vertices: [
            { x: -9.0, y: -1.0 },
            { x: -13.2, y: -0.95 },
            { x: -16.8, y: -0.6 },
            { x: -19.6, y: -0.25 },
            { x: -19.6, y: 0.25 },
            { x: -16.8, y: 0.6 },
            { x: -13.2, y: 0.95 },
            { x: -9.0, y: 1.0 },
          ],
          fill: { type: "base", brightness: -0.04 },
          stroke: { type: "base", width: 1.0, brightness: -0.06 },
        },
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [
            { x: -18.2, y: -0.2, width: 2.0 },
            { x: -26.0, y: -0.9, width: 1.2 },
            { x: -33.2, y: -1.4, width: 0.6 },
          ],
          {
            requiresModule: "freezingTail",
            fill: { type: "base", brightness: -0.02 },
            stroke: { type: "base", width: 0.8, brightness: -0.08 },
            anim: { type: "sway", periodMs: 1880, amplitude: 5.1, falloff: "tip", axis: "normal", phase: 0.18 },
            groupId: "freezingTail-main",
          },
          { epsilon: 0.28, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<Omit<PlayerUnitRendererLayerConfig, "shape" | "vertices">>(
          [
            { x: -30.6, y: -1.2, width: 1.0 },
            { x: -34.0, y: -0.4, width: 0.6 },
          ],
          {
            requiresModule: "freezingTail",
            fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.66, g: 0.95, b: 1, a: 0.78 } } },
            anim: { type: "sway", periodMs: 1880, amplitude: 5.4, falloff: "tip", axis: "normal", phase: 0.48 },
            groupId: "freezingTail-glow",
          },
          { epsilon: 0.2, winding: "CCW" }
        ),
        {
          shape: "polygon",
          requiresModule: "freezingTail",
          vertices: [
            { x: -33.0, y: -0.9 },
            { x: -36.4, y: -0.5 },
            { x: -32.4, y: -0.1 },
            { x: -30.0, y: -0.6 },
          ],
          fill: { type: "solid", fill: { fillType: FILL_TYPES.SOLID, color: { r: 0.66, g: 0.95, b: 1, a: 0.85 } } },
          stroke: { type: "solid", width: 0.6, color: { r: 0.24, g: 0.62, b: 0.95, a: 1 } },
        },
        {
          shape: "circle",
          requiresModule: "freezingTail",
          radius: 22.0,
          offset: { x: -35.2, y: -0.6 },
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.56, g: 0.92, b: 1, a: 0.62 } },
                { offset: 0.55, color: { r: 0.34, g: 0.76, b: 1, a: 0.34 } },
                { offset: 1, color: { r: 0.16, g: 0.52, b: 1, a: 0 } },
              ],
            },
          },
        },

        // Effects
        {
          shape: "circle",
          radius: 32,
          segments: 48,
          offset: { x: 0, y: 0 },
          requiresEffect: 'frenzyAura',
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 24,
              stops: [
                { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.6, color: { r: 0.6, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.75, color: { r: 1.0, g: 0.8, b: 0.5, a: 0.25 } },
                { offset: 1, color: { r: 1.0, g: 0.9, b: 0.5, a: 0.0 } },
              ],
            },
          },
        },
      ],
      auras: [
        {
          requiresModule: "mendingGland",
          petalCount: 12,
          innerRadius: 12,
          outerRadius: 36,
          petalWidth: 12,
          rotationSpeed: 0.8,
          color: { r: 0.6, g: 1.0, b: 0.7, a: 0.6 },
          alpha: 0.45,
          pointInward: true, // Пелюстки спрямовані всередину
        },
        {
          requiresModule: "frenzyGland",
          petalCount: 12,
          innerRadius: 12,
          outerRadius: 36,
          petalWidth: 12,
          rotationSpeed: 1.2,
          color: { r: 1.0, g: 0.5, b: 0.5, a: 0.6 },
          alpha: 0.45,
        },
      ],
    },
    maxHp: 10,
    armor: 1,
    baseAttackDamage: 1.25,
    baseAttackInterval: 0.6,
    baseAttackDistance: 5,
    moveSpeed: 100,
    moveAcceleration: 100,
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
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.35, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.5, g: 0.85, b: 0.95, a: 0.1 } },
          { offset: 0.25, color: { r: 0.5, g: 0.85, b: 0.95, a: 0.05 } },
          { offset: 1, color: { r: 0.5, g: 0.85, b: 0.95, a: 0 } },
        ],
        noise: {
          colorAmplitude: 0.0,
          alphaAmplitude: 0.02,
          scale: 0.3,
        },
      },
      shape: "circle",
      maxParticles: 100,
    },
    cost: {
      mana: 5,
      sanity: 0,
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
