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

export const BOSSES_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = {
  encagedBeastEnemy: {
    name: "Encaged Beast",
    renderer: {
      kind: "composite",
      fill: { r: 0.9, g: 0.7, b: 0.8, a: 1 },
      layers: [
        // Chord
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: 0, y: 0 },
            { x: -7, y: -6 },
            { x: -7, y: 6 },
          ],
        },
        {
          shape: "polygon",
          fill: { type: "base", brightness: 0.2 },
          vertices: [
            { x: -6, y: -3 },
            { x: -10, y: -8 },
            { x: -20, y: -8 },
            { x: -24, y: -3 },
            { x: -24, y: 3 },
            { x: -20, y: 8 },
            { x: -10, y: 8 },
            { x: -6, y: 3 },
          ],
        },
        {
          shape: "circle",
          radius: 42,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",

            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 0.8, b: 1, a: 0.45 } },
                { offset: 0.6, color: { r: 1, g: 0.8, b: 1, a: 0.3 } },
                { offset: 1, color: { r: 1.0, g: 0.7, b: 0.8, a: 0.0 } },
              ],
            },
          },
        },
        
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: -4, y: 3, width: 4.6 },
            { x: -1, y: 4, width: 4.6 },
            { x: 7, y: 5, width: 4.4 },
            { x: 12, y: 7, width: 3.9 },
            { x: 16, y: 10, width: 3.6 },
            { x: 18, y: 13, width: 3.3 },
            { x: 19, y: 16, width: 2.6 },
            { x: 18, y: 19, width: 2.4 },
            { x: 16, y: 22, width: 2.2 },
            { x: 12, y: 25, width: 2.0 },
            { x: 7, y: 26, width: 1.8 },
            { x: 2, y: 27, width: 1.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
            { x: -4, y: -3, width: 4.6 },
            { x: -1, y: -4, width: 4.6 },
            { x: 7, y: -5, width: 4.4 },
            { x: 12, y: -7, width: 3.9 },
            { x: 16, y: -10, width: 3.6 },
            { x: 18, y: -13, width: 3.3 },
            { x: 19, y: -16, width: 2.6 },
            { x: 18, y: -19, width: 2.4 },
            { x: 16, y: -22, width: 2.2 },
            { x: 12, y: -25, width: 2.0 },
            { x: 7, y: -26, width: 1.8 },
            { x: 2, y: -27, width: 1.6 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
            { x: -24, y: -3, width: 1.9 },
            { x: -29, y: -8, width: 1.6 },
            { x: -31, y: -14, width: 1.3 },
            { x: -35, y: -19, width: 1.0 },
            { x: -38, y: -23, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
            { x: -20, y: -8, width: 1.9 },
            { x: -21, y: -14, width: 1.6 },
            { x: -24, y: -18, width: 1.3 },
            { x: -25, y: -22, width: 1.0 },
            { x: -28, y: -26, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
            { x: -24, y: 3, width: 1.9 },
            { x: -29, y: 8, width: 1.6 },
            { x: -31, y: 14, width: 1.3 },
            { x: -35, y: 19, width: 1.0 },
            { x: -38, y: 23, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
            { x: -20, y: 8, width: 1.9 },
            { x: -21, y: 14, width: 1.6 },
            { x: -24, y: 18, width: 1.3 },
            { x: -25, y: 22, width: 1.0 },
            { x: -28, y: 26, width: 0.8 },
          ],
          {
            fill: { type: "base", brightness: 0.3 },
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
      ],
    },
    maxHp: 25000,
    armor: 100,
    baseDamage: 600,
    attackInterval: 1.8,
    attackRange: 40,
    moveSpeed: 20,
    physicalSize: 35,
    soulRewardBase: 3,
    reward: {
      stone: 2000,
      iron: 200,
    },
    /*
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
    },*/
    knockBackDistance: 80,
    knockBackSpeed: 120,
  },
  greatOctopusBody: {
    name: "The Great Octopus",
    renderer: {
      kind: "composite",
      fill: { r: 0.15, g: 0.55, b: 0.8, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 76,
          segments: 48,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.75, g: 0.85, b: 1, a: 1 } },
                { offset: 0.5, color: { r: 0.75, g: 0.85, b: 1, a: 0.8 } },
                { offset: 1, color: { r: 0.15, g: 0.55, b: 0.8, a: 0 } },
              ],
            }
          }
          
        },
        {
          shape: "circle",
          radius: 38,
          segments: 32,
          fill: { type: "base", brightness: 0.1, alphaMultiplier: 0.7 },
        },
      ],
    },
    tentacles: {
      spines: (() => {
        const TENTACLE_COUNT = 8;
        const POINTS_PER_TENTACLE = 6;
        const BASE_RADIUS = 38;
        const TIP_RADIUS = 180;
        return Array.from({ length: TENTACLE_COUNT }, (_, t) => {
          const angle = (t / TENTACLE_COUNT) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return Array.from({ length: POINTS_PER_TENTACLE }, (_, i) => {
            const frac = i / (POINTS_PER_TENTACLE - 1);
            const r = BASE_RADIUS + frac * (TIP_RADIUS - BASE_RADIUS);
            const width = 10 * (1 - frac * 0.75);
            const wobble = Math.sin(frac * Math.PI * 2 + t) * 12 * frac;
            const perpCos = -sin;
            const perpSin = cos;
            return {
              x: cos * r + perpCos * wobble,
              y: sin * r + perpSin * wobble,
              width,
            };
          });
        });
      })(),
      segmentsPerTentacle: 5,
      anim: {
        type: "sway" as const,
        periodMs: 2200,
        amplitude: 6,
        falloff: "tip" as const,
        axis: "normal" as const,
        phase: 0,
      },
      fill: { type: "base" as const, brightness: 0.3, saturationShift: 0.1, colorAnimation: { 
        interval: 2000, 
        keyframes: [
          { time: 0, deltaHue: 0 },
          { time: 0.5, deltaHue: 0.14 }, 
          { time: 1, deltaHue: 0 }
        ] 
      } },
      stroke: { type: "base" as const, width: 1.2, brightness: -0.1, hueShift: 0.3 },
      buildOpts: { epsilon: 0.3, winding: "CCW" as const },
      tipGlow: {
        radius: 12,
        segments: 16,
        fill: {
          type: "gradient" as const,
          fill: {
            fillType: FILL_TYPES.RADIAL_GRADIENT,
            start: { x: 0, y: 0 },
            stops: [
              { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.7 } },
              { offset: 0.5, color: { r: 0.4, g: 0.7, b: 1, a: 0.3 } },
              { offset: 1, color: { r: 0.3, g: 0.6, b: 1, a: 0 } },
            ],
          },
        },
      },
    },
    maxHp: 500000,
    armor: 15000,
    baseDamage: 4000,
    attackInterval: 2.5,
    attackRange: 350,
    moveSpeed: 0,
    physicalSize: 50,
    lockRotation: true,
    requireDestruction: true,
    blocksUnits: true,
    knockBackDistance: 220,
    knockBackSpeed: 360,
    reward: normalizeResourceAmount({ stone: 5000, iron: 500 }),
    soulRewardBase: 50,
    arcAttack: {
      arcType: "plasmaBeam",
      explosionType: "plasmaBeam",
      explosionRadius: 48,
    },
  },
  greatOctopusSegment: {
    name: "Tentacle Segment",
    renderer: {
      kind: "polygon",
      fill: { r: 0, g: 0, b: 0, a: 0 },
      vertices: [
        { x: -2, y: -2 },
        { x: 2, y: -2 },
        { x: 2, y: 2 },
        { x: -2, y: 2 },
      ],
    },
    maxHp: 30000,
    armor: 2000,
    baseDamage: 1500,
    attackInterval: 5,
    attackRange: 1260,
    projectileMinSegmentIndex: 4,
    moveSpeed: 0,
    physicalSize: 14,
    lockRotation: true,
    blocksUnits: true,
    contactDamage: true,
    knockBackDistance: 220,
    knockBackSpeed: 260,
    projectileKnockBackDistance: 0,
    projectileKnockBackSpeed: 0,
    reward: normalizeResourceAmount({ stone: 200, iron: 20 }),
    soulRewardBase: 4,
    selfKnockBackDistance: 120,
    selfKnockBackSpeed: 200,
    meleeHitExplosion: { type: "tentacleHit", radius: 14 },
    projectile: {
      damage: 480,
      radius: 6,
      speed: 80,
      lifetimeMs: 7900,
      destroyOnHit: false,
      targetHitCooldownMs: 120,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.75, g: 0.82, b: 0.96, a: 0 },
      },
      attackSeries: {
        shots: 4,
        intervalMs: 200,
      },
      hitRadius: 34,
      damageRadius: 34,
      particleCluster: {
        particlesPerSecond: 300,
        particleLifetimeMs: 860,
        emissionDurationMs: 1400,
        fadeStartMs: 120,
        baseSpeed: 0.04,
        speedVariation: 0.01,
        spread: Math.PI * 2,
        offset: { x: 0, y: 0 },
        spawnRadius: { min: 0, max: 8 },
        sizeRange: { min: 15, max: 32 },
        sizeEvolutionMult: 2.35,
        color: { r: 1, g: 0.72, b: 0.2, a: 0.75 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.95, g: 0.95, b: 1, a: 0.19 } },
            { offset: 0.5, color: { r: 0.8, g: 0.87, b: 1, a: 0.08 } },
            { offset: 1, color: { r: 0.02, g: 0.24, b: 1, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.02,
            scale: 0.3,
          },
        },
        maxParticles: 240,
      },
      rendererCustomData: {
        renderComponents: {
          body: false,
          tail: false,
          glow: false,
          emitters: true,
        },
      },
    },
  },};
