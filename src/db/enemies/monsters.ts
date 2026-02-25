import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { normalizeResourceAmount } from "../resources-db";
import type { EnemyConfig, EnemyRendererLayerConfig, EnemyType } from "./enemies.types";
import { mapLineToPolygonShape } from "@/shared/helpers/paths.helper";
import {
  BASIC_ENEMY_VERTICES,
  FAST_ENEMY_VERTICES,
  PORTAL_SPAWNER_VERTICES,
  TANK_ENEMY_VERTICES,
  TURRET_ENEMY_VERTICES,
  TURRET_ENEMY_VERTICES_FB,
} from "./enemies.const";

export const MONSTERS_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = {
  basicEnemy: {
    name: "Basic Enemy",
    renderer: {
      kind: "polygon",
      fill: { r: 0.8, g: 0.2, b: 0.2, a: 1 },
      stroke: {
        color: { r: 0.9, g: 0.3, b: 0.3, a: 1 },
        width: 1.5,
      },
      vertices: BASIC_ENEMY_VERTICES,
    },
    maxHp: 20,
    armor: 2,
    baseDamage: 4,
    attackInterval: 1.2,
    attackRange: 240,
    moveSpeed: 30,
    physicalSize: 14,
    soulRewardBase: 1,
    reward: normalizeResourceAmount({
      stone: 1,
    }),
  },
  fastEnemy: {
    name: "Fast Enemy",
    renderer: {
      kind: "polygon",
      fill: { r: 0.9, g: 0.6, b: 0.2, a: 1 },
      stroke: {
        color: { r: 1, g: 0.7, b: 0.3, a: 1 },
        width: 1.5,
      },
      vertices: FAST_ENEMY_VERTICES,
    },
    maxHp: 120,
    armor: 1,
    baseDamage: 300,
    attackInterval: 0.8,
    attackRange: 200,
    moveSpeed: 50,
    physicalSize: 12,
    soulRewardBase: 1,
    reward: normalizeResourceAmount({
      stone: 1,
    }),
  },
  tankEnemy: {
    name: "Tank Enemy",
    renderer: {
      kind: "composite",
      fill: { r: 0.6, g: 0.5, b: 0.3, a: 1 },
      layers: [
        {
          shape: "sprite",
          width: 18,
          height: 18,
          spritePath: "tank_enemy_part0.png",
          offset: { x: 9, y: 0 },
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -6, width: 2.6 },
            { x: -4, y: -6.5, width: 2.3 },
            { x: -7, y: -7.5, width: 2.0 },
            { x: -9, y: -9, width: 1.7 },
            { x: -10, y: -11, width: 1.4 },
            { x: -11, y: -11, width: 1.0 },
          ],
          {
            fill: { type: "base", brightness: -0.1 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 2,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 6, width: 2.6 },
            { x: -4, y: 6.5, width: 2.3 },
            { x: -7, y: 7.5, width: 2.0 },
            { x: -9, y: 9, width: 1.7 },
            { x: -10, y: 11, width: 1.4 },
            { x: -11, y: 11, width: 1.0 },
          ],
          {
            fill: { type: "base", brightness: -0.1 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 2,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
      ],
    },
    maxHp: 500,
    armor: 50,
    baseDamage: 600,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 20,
    physicalSize: 18,
    soulRewardBase: 2,
    reward: {
      stone: 2,
    },
    // Приклад конфігурації снаряда для танка
    projectile: {
      radius: 8,
      speed: 200,
      lifetimeMs: 2000,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.5, b: 1, a: 1 },
      },
      shape: "circle",
      hitRadius: 10,
    },
  },
  spectreEnemy: {
    name: "Spectre",
    renderer: {
      kind: "composite",
      fill: { r: 0.9, g: 0.8, b: 0.6, a: 1 },
      layers: [
        // Chord
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 20, y: 0 },
            { x: 14, y: -3 },
            { x: 14, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 14, y: -3 },
            { x: 10, y: -8 },
            { x: 10, y: 8 },
            { x: 14, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 10, y: -1 },
            { x: -14, y: -2 },
            { x: -14, y: 2 },
            { x: 10, y: 1 },
          ],
        },
        {
          shape: "circle",
          radius: 32,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 1, b: 1, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 1, b: 1, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.9, b: 0.8, a: 0.0 } },
              ],
            },
          },
        },
        /*
            ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: -3, width: 1.2 }, {x: 1, y: -8, width: 1.0}, { x: 2, y: -10, width: 0.8}, { x: 3, y: -12, width: 0.6}, { x: 4, y: -14, width: 0.5}, { x: 6, y: -18, width: 0.4}],
                { fill: { type: "base", brightness: 0.3 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
              ),

              ...mapLineToPolygonShape<Omit<EnemyRendererLayerConfig, "shape" | "vertices">>(
                [{ x: 0, y: 3, width: 1.2 }, {x: 1, y: 8, width: 1.0}, { x: 2, y: 10, width: 0.8}, { x: 3, y: 12, width: 0.6 }, { x: 4, y: 14, width: 0.5 }, { x: 6, y: 18, width: 0.4}],
                { fill: { type: "base", brightness: 0.3 }, stroke: { type: "base", width: 1.4, brightness: -0.12 }, anim: { type: "sway", periodMs: 1500, amplitude: 2, falloff: "tip", axis: "normal", phase: 1.1 } },
                { epsilon: 0.25, winding: "CCW" }
              ),*/
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -2, width: 1.2 },
            { x: 0, y: -8, width: 1.0 },
            { x: 2.5, y: -14, width: 0.8 },
            { x: 2.5, y: -19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: -2, width: 1.2 },
            { x: -6, y: -8, width: 1.0 },
            { x: -4, y: -14, width: 0.8 },
            { x: -5, y: -20, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -11, y: -2, width: 1.2 },
            { x: -13, y: -8, width: 1.0 },
            { x: -13, y: -14, width: 0.8 },
            { x: -16, y: -19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),

        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 2, width: 1.2 },
            { x: 0, y: 8, width: 1.0 },
            { x: 2.5, y: 14, width: 0.8 },
            { x: 2.5, y: 19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 2, width: 1.2 },
            { x: -6, y: 8, width: 1.0 },
            { x: -4, y: 14, width: 0.8 },
            { x: -5, y: 20, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -11, y: 2, width: 1.2 },
            { x: -13, y: 8, width: 1.0 },
            { x: -13, y: 14, width: 0.8 },
            { x: -16, y: 19, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
      ],
    },
    maxHp: 2500,
    armor: 100,
    baseDamage: 400,
    soulRewardBase: 1,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 75,
    physicalSize: 30,
    reward: {
      stone: 2,
    },
    projectile: {
      radius: 6,
      speed: 200,
      lifetimeMs: 2000,
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 0.8, g: 0.9, b: 1, a: 1 } },
          { offset: 1, color: { r: 0.8, g: 0.9, b: 1, a: 0 } },
        ],
      },
      shape: "circle",
      hitRadius: 10,
      explosion: "iceBrickHit",
    },
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  coalConvoyGuardian: {
    name: "Coal Convoy Guardian",
    renderer: {
      kind: "composite",
      fill: { r: 1, g: 0.7, b: 0.6, a: 1 },
      layers: [
        // Spike
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 24, y: 0 },
            { x: 10, y: -3 },
            { x: 10, y: 3 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 10, y: -3 },
            { x: 10, y: 3 },
            { x: -5, y: 1 },
            { x: -5, y: -1 },
          ],
        },
        {
          shape: "circle",
          radius: 32,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 0.8, b: 0.6, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 0.8, b: 0.6, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.8, b: 0.6, a: 0.0 } },
              ],
            },
          },
        },
        // Left side
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 5, y: -8, width: 1.0 },
            { x: 0, y: -22, width: 0.8 },
            { x: -5, y: -26, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 3, y: -8, width: 1.0 },
            { x: -4, y: -18, width: 0.8 },
            { x: -11, y: -21, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: -2, width: 1.2 },
            { x: 0, y: -8, width: 1.0 },
            { x: -10, y: -16, width: 0.8 },
            { x: -20, y: -18, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 0, width: 1.2 },
            { x: -15, y: -8, width: 1.0 },
            { x: -20, y: -8, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),

        // Right side
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 5, y: 8, width: 1.0 },
            { x: 0, y: 22, width: 0.8 },
            { x: -5, y: 26, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 3, y: 8, width: 1.0 },
            { x: -4, y: 18, width: 0.8 },
            { x: -11, y: 21, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 10, y: 2, width: 1.2 },
            { x: 0, y: 8, width: 1.0 },
            { x: -10, y: 16, width: 0.8 },
            { x: -20, y: 18, width: 0.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -5, y: 0, width: 1.2 },
            { x: -15, y: 8, width: 1.0 },
            { x: -20, y: 8, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            stroke: { type: "base", width: 1.4, brightness: -0.12 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 4.24,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        
      ],
    },
    maxHp: 25000,
    soulRewardBase: 2,
    armor: 100,
    baseDamage: 1600,
    attackInterval: 0.8,
    attackRange: 520,
    moveSpeed: 60,
    physicalSize: 30,
    reward: {
      stone: 2,
    },
    projectile: {
      radius: 4,
      speed: 200,
      lifetimeMs: 5000,
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 1, g: 0.9, b: 0.7, a: 1 } },
          { offset: 0.75, color: { r: 1, g: 0.9, b: 0.7, a: 0.8 } },
          { offset: 1, color: { r: 1, g: 0.9, b: 0.7, a: 0 } },
        ],
      },
      tail: {
        lengthMultiplier: 6.0,
        widthMultiplier: 1.0,
        startColor: { r: 1, g: 0.9, b: 0.7, a: 0.11 },
        endColor: { r: 1, g: 0.9, b: 0.7, a: 0 },
      },
      tailEmitter: {
        particlesPerSecond: 490,
        particleLifetimeMs: 550,
        fadeStartMs: 200,
        baseSpeed: 0.05,
        speedVariation: 0.01,
        sizeRange: { min: 4.2, max: 8.4 },
        sizeEvolutionMult: 2.75, // Particles grow from 1x to 1.25x size over lifetime
        spread: Math.PI / 5.5,
        offset: { x: -0.75, y: 0 },
        color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          start: { x: 0, y: 0 },
          stops: [
            { offset: 0, color: { r: 1, g: 0.85, b: 0.5, a: 0.1 } },
            { offset: 0.25, color: { r: 1, g: 0.85, b: 0.5, a: 0.05 } },
            { offset: 1, color: { r: 1, g: 0.85, b: 0.5, a: 0 } },
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
      shape: "circle",
      hitRadius: 10,
      explosion: "smallPlasmoid",
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.05,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 1, g: 0.75, b: 0.6, a: 0.1 } },
          { offset: 0.25, color: { r: 1, g: 0.75, b: 0.6, a: 0.05 } },
          { offset: 1, color: { r: 1, g: 0.75, b: 0.6, a: 0 } },
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
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  silverKeeperEnemy: {
    name: "Silver Keeper",
    renderer: {
      kind: "composite",
      fill: { r: 0.7, g: 0.75, b: 0.8, a: 1 },
      layers: [
        // Head
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 24, y: 0 },
            { x: 20, y: -5 },
            { x: 16, y: -5 },
            { x: 16, y: 5 },
            { x: 20, y: 5 },
          ],
        },
        // Tentacles Left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 18, y: -3, width: 2.5 },
            { x: 22, y: -8, width: 2.1 },
            { x: 29, y: -9, width: 1.8 },
            { x: 34, y: -12, width: 1.4 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperLeft",
            connectionSlots: [{ id: "silverKeeperTentacle_left", mode: "spine", t: 1 }],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 8,
          segments: 32,
          offset: { x: 0, y: 0 },
          join: { anchorId: "silverKeeperTentacle_left", targetGroupId: "silverKeeperLeft" },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.8, b: 1.0, a: 0.75 } },
                { offset: 0.6, color: { r: 0.9, g: 0.8, b: 1, a: 0.2 } },
                { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0.0 } },
              ],
            },
          },
        },

        // Tentacles Right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 18, y: 3, width: 2.5 },
            { x: 22, y: 8, width: 2.1 },
            { x: 29, y: 9, width: 1.8 },
            { x: 34, y: 12, width: 1.4 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperRight",
            connectionSlots: [{ id: "silverKeeperTentacle_right", mode: "spine", t: 1 }],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 8,
          segments: 32,
          offset: { x: 0, y: 0 },
          join: { anchorId: "silverKeeperTentacle_right", targetGroupId: "silverKeeperRight" },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.8, b: 1.0, a: 0.75 } },
                { offset: 0.6, color: { r: 0.9, g: 0.8, b: 1, a: 0.2 } },
                { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0.0 } },
              ],
            },
          },
        },
        // tail
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 17, y: 0, width: 3.5 },
            { x: 10, y: -3, width: 3.1 },
            { x: -4, y: 3, width: 2.8 },
            { x: -16, y: -2, width: 2.4 },
            { x: -25, y: 1, width: 1.2 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
            anim: {
              type: "sway",
              periodMs: 1500,
              amplitude: 6,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            groupId: "silverKeeperTail",
            connectionSlots: [
              { id: "silverKeeperTail1", mode: "spine", t: 0.25 },
              { id: "silverKeeperTail2", mode: "spine", t: 0.5 },
              { id: "silverKeeperTail3", mode: "spine", t: 0.75 },
            ],
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 1 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.8 },
            { x: -7, y: -6, width: 1.3 },
            { x: -9, y: -11, width: 0.8 },
            { x: -11, y: -16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.4 },
            anim: {
              type: "sway",
              periodMs: 1100,
              amplitude: 4,
              falloff: "tip",
              axis: "normal",
              phase: 0.0,
            },
            join: { anchorId: "silverKeeperTail1", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 1 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.8 },
            { x: -7, y: 6, width: 1.3 },
            { x: -9, y: 11, width: 0.8 },
            { x: -11, y: 16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.4 },
            anim: {
              type: "sway",
              periodMs: 1100,
              amplitude: 4,
              falloff: "tip",
              axis: "normal",
              phase: 0.5,
            },
            join: { anchorId: "silverKeeperTail1", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 2 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.6 },
            { x: -7, y: -6, width: 1.3 },
            { x: -11, y: -11, width: 0.8 },
            { x: -14, y: -16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.45 },
            anim: {
              type: "sway",
              periodMs: 1000,
              amplitude: 3.5,
              falloff: "tip",
              axis: "normal",
              phase: 0.3,
            },
            join: { anchorId: "silverKeeperTail2", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 2 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.6 },
            { x: -7, y: 6, width: 1.3 },
            { x: -11, y: 11, width: 0.8 },
            { x: -14, y: 16, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.45 },
            anim: {
              type: "sway",
              periodMs: 1000,
              amplitude: 3.5,
              falloff: "tip",
              axis: "normal",
              phase: 0.8,
            },
            join: { anchorId: "silverKeeperTail2", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 3 — left
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.4 },
            { x: -7, y: -4, width: 1.3 },
            { x: -11, y: -9, width: 0.8 },
            { x: -14, y: -13, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.5 },
            anim: {
              type: "sway",
              periodMs: 900,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 0.6,
            },
            join: { anchorId: "silverKeeperTail3", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        // Tail sprout 3 — right
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: 0, width: 1.4 },
            { x: -7, y: 4, width: 1.3 },
            { x: -11, y: 9, width: 0.8 },
            { x: -14, y: 13, width: 0.4 },
          ],
          {
            fill: { type: "base", brightness: 0.5 },
            anim: {
              type: "sway",
              periodMs: 900,
              amplitude: 3,
              falloff: "tip",
              axis: "normal",
              phase: 1.1,
            },
            join: { anchorId: "silverKeeperTail3", targetGroupId: "silverKeeperTail" },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        
      ],
    },
    maxHp: 12500,
    soulRewardBase: 2,
    armor: 1000,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 280,
    moveSpeed: 60,
    physicalSize: 30,
    reward: {
      silver: 10,
    },
    arcAttack: {
      arcType: "silverKeeper",
      spawnOffset: { x: 20, y: 0 },
      chainRadius: 150,
      chainJumps: 3,
      damage: 650,
      damageOptions: {
        rewardMultiplier: 1.0,
        armorPenetration: 0,
        skipKnockback: true,
      },
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.05,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75, // Particles grow from 1x to 1.25x size over lifetime
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.9, g: 0.8, b: 1, a: 0.1 } },
          { offset: 0.25, color: { r: 0.9, g: 0.8, b: 1, a: 0.05 } },
          { offset: 1, color: { r: 0.9, g: 0.8, b: 1, a: 0 } },
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
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  snakeEnemy: {
    name: "Snake",
    renderer: {
      kind: "composite",
      fill: { r: 0.38, g: 0.62, b: 0.22, a: 1 },
      layers: [
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            /*{ x: 18, y: 0, width: 7 },
            { x: 12, y: 0, width: 7 },*/
            { x: 18, y: 0, width: 7 },
            { x: 16, y: 0, width: 7 },
            { x: 14, y: -0.5, width: 7 },
            { x: 12, y: -1.5, width: 7 },
            { x: 10, y: -2.9, width: 7 },
            { x: 8, y: -4, width: 7 },
            { x: 6, y: -4, width: 7 },
            { x: 4, y: -2.9, width: 7 },
            { x: 2, y: -1, width: 6 },
            { x: 0, y: 1, width: 6 },
            { x: -2, y: 2.7, width: 6 },
            { x: -4, y: 3.5, width: 6 },
            { x: -6, y: 3.5, width: 6 },
            { x: -8, y: 2.7, width: 5 },
            { x: -10, y: 1, width: 5 },
            { x: -12, y: -1, width: 5 },
            { x: -14, y: -2.3, width: 5 },
            { x: -16, y: -3, width: 4 },
            { x: -18, y: -3, width: 4 },
            { x: -20, y: -2.3, width: 4 },
            { x: -22, y: -1, width: 4 },
            { x: -24, y: 1, width: 3 },
            { x: -26, y: 2.2, width: 3 },
            { x: -28, y: 3.0, width: 3 },
            { x: -30, y: 3.0, width: 3 },
            { x: -32, y: 2.2, width: 3 },
            { x: -34, y: 1, width: 3 },
          ],
          {
            fill: { type: "base", brightness: 0.1 },
            anim: {
              type: "sway",
              periodMs: 1200,
              amplitude: 5,
              falloff: "tip",
              axis: "normal",
              phase: 0.4,
            },
          },
          { epsilon: 0.25, winding: "CCW" },
        ),
        {
          shape: "circle",
          radius: 25,
          offset: { x: 20, y: -2 },
          fill: { type: "gradient", fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            stops: [
              { offset: 0, color: { r: 0.38, g: 0.62, b: 0.22, a: 0.25 } },
              { offset: 0.5, color: { r: 0.68, g: 0.92, b: 0.62, a: 0.35 } },
              { offset: 1, color: { r: 0.88, g: 1, b: 0.88, a: 0.0 } },
            ],
          } },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 28, y: 0 },
            { x: 19, y: 3 },
            { x: 17, y: 3 },
            { x: 17, y: -3 },
            { x: 19, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 35, y: -11 },
            { x: 21, y: 0 },
            { x: 17, y: -2 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 35, y: 11 },
            { x: 21, y: 0 },
            { x: 17, y: 2 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 150000,
    armor: 3200,
    baseDamage: 1800,
    attackInterval: 2,
    attackRange: 140,
    moveSpeed: 35,
    physicalSize: 20,
    reward: normalizeResourceAmount({
      organics: 500,
    }),
    soulRewardBase: 4,
    requireDestruction: true,
    projectile: {
      damage: 1800,
      radius: 24,
      speed: 110,
      lifetimeMs: 2000,
      statusEffectId: "poison",
      statusEffectOptions: {
        durationMs: 4000,
        damagePerSecond: 1400,
      },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.3, g: 0.8, b: 0.2, a: 1 },
      },
      shape: "sprite",
      spriteName: "poison",
      hitRadius: 28,
    },
    knockBackDistance: 100,
    knockBackSpeed: 150,
  },
};
