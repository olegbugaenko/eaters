import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import { normalizeResourceAmount } from "../resources-db";
import type { EnemyConfig, EnemyRendererLayerConfig, EnemyType } from "./enemies.types";
import { mapLineToPolygonShape } from "@/shared/helpers/paths.helper";

export const TURRETS_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = {
  turretEnemy: {
    name: "Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.6, g: 0.6, b: 0.6, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 175,
    armor: 14,
    baseDamage: 34,
    attackInterval: 1.5,
    attackRange: 400,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 20,
      iron: 4,
    }),
    projectile: {
      radius: 5,
      speed: 150,
      lifetimeMs: 2500,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.6, g: 0.6, b: 0.4, a: 1 },
      },
      shape: "circle",
      hitRadius: 8,
      damageRadius: 34,
      explosion: "smallCannon", // Тип експлозії при влучанні снаряда
    },
    knockBackDistance: 120,
    knockBackSpeed: 160,
  },
  burstTurretEnemy: {
    name: "Burst Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.8, b: 0.7, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 30,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.55, g: 0.8, b: 0.7, a: 0.4 } },
                { offset: 1, color: { r: 0.55, g: 0.8, b: 0.7, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.1 },
        },
      ],
    },
    maxHp: 7500,
    armor: 400,
    baseDamage: 240,
    attackInterval: 2.5,
    attackRange: 400,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 50,
      iron: 10,
    }),
    projectile: {
      radius: 12,
      speed: 130,
      lifetimeMs: 4500,
      damageRadius: 18,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.6, g: 0.6, b: 0.4, a: 1 },
      },
      shape: "sprite",
      spriteName: "energetic_strike",
      hitRadius: 8,
      explosion: "smallEnergetic",
      attackSeries: {
        shots: 3,
        intervalMs: 200,
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.6, g: 0.8, b: 0.8, a: 0.11 },
        endColor: { r: 0.6, g: 0.8, b: 0.8, a: 0 },
      },
      tailEmitter: {
        baseSpeed: 0.03,
        speedVariation: 0.0,
        particleLifetimeMs: 600,
        fadeStartMs: 700,
        color: { r: 1, g: 0.85, b: 0.55, a: 1 },
        arc: Math.PI * 0.15,
        direction: 0,
        particlesPerSecond: 1000,
        sizeRange: { min: 14.5, max: 18.4 },
        spawnRadius: { min: 0, max: 0.1 },
        spawnRadiusMultiplier: 1.25,
        sizeEvolutionMult: 2.0,
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.4, g: 0.9, b: 0.8, a: 0.05 } },
            { offset: 1, color: { r: 0.4, g: 0.9, b: 0.8, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.003,
            scale: 0.35,
          },
        },
        maxParticles: 1000,
      },
    },
    knockBackDistance: 120,
    knockBackSpeed: 160,
  },
  volleyTurretEnemy: {
    name: "Volley Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.7, b: 0.5, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
      ],
    },
    maxHp: 3135,
    armor: 9,
    baseDamage: 240,
    attackInterval: 1.4,
    attackRange: 380,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 550,
      copper: 120,
    }),
    projectile: {
      radius: 9,
      speed: 170,
      lifetimeMs: 2200,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.8, b: 0.75, a: 0.2 },
      },
      shape: "sprite",
      spriteName: "needle",
      hitRadius: 7,
      explosion: "smallCannonGrey",
      ringTrail: {
        spawnIntervalMs: 60,
        lifetimeMs: 820,
        startRadius: 5,
        endRadius: 21,
        startAlpha: 0.065,
        endAlpha: 0,
        innerStop: 0.46,
        outerStop: 0.76,
        color: { r: 0.5, g: 0.7, b: 0.75, a: 0.08 },
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
    },
    projectileVolley: {
      count: 5,
      spreadAngleDeg: 12,
    },
    knockBackDistance: 110,
    knockBackSpeed: 130,
    projectileKnockBackDistance: 40,
    projectileKnockBackSpeed: 10,
  },
  wheelVolleyTurretEnemy: {
    name: "Doomed Ballista",
    renderer: {
      kind: "composite",
      fill: { r: 0.3, g: 0.15, b: 0.0, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 50,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.8, g: 0.55, b: 0.9, a: 0.4 } },
                { offset: 1, color: { r: 0.8, g: 0.55, b: 0.9, a: 0 } },  
              ],
            }
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -3 },
            { x: -15, y: -4 },
            { x: -15, y: 4 },
            { x: 14, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 5, y: -20, width: 2 },
            { x: 8, y: -18, width: 3 },
            { x: 12, y: -12, width: 4 },
            { x: 14, y: -6, width: 5 },
            { x: 14, y: 6, width: 5 },
            { x: 12, y: 12, width: 4 },
            { x: 8, y: 18, width: 3 },
            { x: 5, y: 20, width: 2 },
          ],
          {
            fill: { type: "base", brightness: 0.1 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 5, y: -20, width: 1 },
            { x: -6, y: -3, width: 1 },
            { x: -7, y: 0, width: 1 },
            { x: -6, y: 3, width: 1 },
            { x: 5, y: 20, width: 1 },
          ],
          {
            fill: { type: "base", brightness: 0.2, saturationShift: -0.4, hueShift: 0.2 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
      ],
    },
    maxHp: 31350,
    armor: 390,
    baseDamage: 1940,
    attackInterval: 1.4,
    attackRange: 380,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 550,
      copper: 120,
    }),
    projectile: {
      radius: 9,
      speed: 170,
      lifetimeMs: 2200,
      statusEffectId: "bleeding",
      statusEffectOptions: {
        damagePerSecond: 700,
      },
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.8, b: 0.75, a: 0.2 },
      },
      shape: "sprite",
      spriteName: "needle",
      hitRadius: 7,
      explosion: "smallCannonGrey",
      ringTrail: {
        spawnIntervalMs: 60,
        lifetimeMs: 820,
        startRadius: 5,
        endRadius: 21,
        startAlpha: 0.065,
        endAlpha: 0,
        innerStop: 0.46,
        outerStop: 0.76,
        color: { r: 0.5, g: 0.7, b: 0.75, a: 0.08 },
      },
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.08,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 2.75,
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.35, g: 0.08, b: 0.55, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.5, g: 0.25, b: 0.6, a: 0.03 } },
          { offset: 0.65, color: { r: 0.5, g: 0.25, b: 0.6, a: 0.15 } },
          { offset: 1, color: { r: 0.5, g: 0.15, b: 0.7, a: 0 } },
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
    projectileVolley: {
      count: 5,
      spreadAngleDeg: 12,
    },
    knockBackDistance: 110,
    knockBackSpeed: 130,
    projectileKnockBackDistance: 40,
    projectileKnockBackSpeed: 10,
  },
  explosionTurretEnemy: {
    name: "Blast Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.75, g: 0.55, b: 0.85, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 30,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.75, g: 0.55, b: 0.85, a: 0.8 } },
                { offset: 1, color: { r: 0.75, g: 0.55, b: 0.85, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "circle",
          radius: 20,
          fill: {
            type: "base",
            brightness: 0.0,
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: -14, y: -2 },
            { x: -14, y: 2 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 2, y: -14 },
            { x: -2, y: -14 },
            { x: -2, y: 14 },
            { x: 2, y: 14 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        
      ],
    },
    maxHp: 2140,
    armor: 30,
    baseDamage: 160,
    attackInterval: 3.2,
    attackRange: 320,
    moveSpeed: 0,
    physicalSize: 30,
    reward: normalizeResourceAmount({
      stone: 60,
      iron: 14,
    }),
    explosionAttack: {
      radius: 320,
      damageMultiplier: 1,
      explosionType: "magnetic",
      explosionRadius: 60,
    },
    knockBackDistance: 140,
    knockBackSpeed: 140,
  },
  bleedingTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Bleeding Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.7, g: 0.45, b: 0.50, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 50,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.55, b: 0.35, a: 0.2 } },
                { offset: 0.6, color: { r: 0.9, g: 0.55, b: 0.35, a: 0.4 } },
                { offset: 1, color: { r: 0.9, g: 0.55, b: 0.35, a: 0 } },
              ],
            }
          }
        },
        {
          shape: "polygon",
          vertices: [
            { x: 18, y: -3 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 18, y: 3 },
          ],
          fill: { type: "base", brightness: -0.7 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -6, y: -14 },
            { x: -13, y: -14 },
            { x: -13, y: 14 },
            { x: -6, y: 14 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.12 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 12, y: -14 },
            { x: -4, y: -22 },
            { x: -25, y: -22 },
            { x: -21, y: -14 },
          ],
          fill: { type: "base", brightness: -0.42 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 12, y: 14 },
            { x: -4, y: 22 },
            { x: -25, y: 22 },
            { x: -21, y: 14 },
          ],
          fill: { type: "base", brightness: -0.42 },
        },
      ],
    },
    maxHp: 25000,
    armor: 1000,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 1600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      iron: 32,
      coal: 6,
    }),
    arcAttack: {
      arcType: "bleeding",
      statusEffectId: "bleeding",
      statusEffectOptions: {
        damagePerSecond: 184,
        durationMs: 4000,
      },
      spawnOffset: { x: 18, y: 0 },
    },
    targeting: {
      avoidSharedTargets: true,
      searchPadding: 200,
    },
  },
  freezeTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Freeze Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.75, b: 0.95, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -4 },
            { x: 0, y: 4 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: 0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -3, y: 8 },
            { x: 0, y: 4 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -8 },
            { x: -9, y: -11 },
            { x: -9, y: -5 },
            { x: -3, y: 3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 8 },
            { x: -9, y: 11 },
            { x: -9, y: 5 },
            { x: -3, y: -3 },
          ],
          fill: { type: "base", brightness: 0.15 },
        },
      ],
    },
    maxHp: 140,
    armor: 10,
    baseDamage: 0,
    attackInterval: 1.8,
    attackRange: 1600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      stone: 30,
      sand: 5,
    }),
    arcAttack: {
      arcType: "freeze",
      statusEffectId: "freeze",
      statusEffectOptions: {
        speedMultiplier: 0.3,
        durationMs: 2000,
      },
    },
    targeting: {
      avoidSharedTargets: true,
      skipTargetsWithEffects: ["freeze"],
      searchPadding: 200,
    },
  },
  spinningAxeTurretEnemy: {
    name: "Spinning Axe Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.45, g: 0.5, b: 0.58, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: -20, y: -2 },
            { x: 20, y: -2 },
            { x: 20, y: 2 },
            { x: -20, y: 2 },
          ],
          fill: { type: "base", brightness: 0.28 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 5, y: -8},
            { x: 2, y: -8 },
            { x: 2, y: 8 },
            { x: 5, y: 8 }
          ],
          fill: { type: "base", brightness: 0.28 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 10, y: -7},
            { x: 35, y: -14 },
            { x: 13, y: -19 },
            { x: 3, y: -19 },
            { x: -12, y: -14 },
            { x: -4, y: -7},
          ],
          fill: { type: "base", brightness: 0.28 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 10, y: 7},
            { x: 35, y: 14 },
            { x: 13, y: 19 },
            { x: 3, y: 19 },
            { x: -12, y: 14 },
            { x: -4, y: 7},
          ],
          fill: { type: "base", brightness: 0.28 },
        },
      ],
    },
    maxHp: 90000,
    armor: 3600,
    baseDamage: 2460,
    attackInterval: 0.9,
    attackRange: 2200,
    moveSpeed: 0,
    lockRotation: true,
    visualRotationSpinningDegPerSec: 360,
    physicalSize: 28,
    reward: normalizeResourceAmount({
      iron: 18,
      coal: 4,
    }),
    projectile: {
      radius: 32,
      speed: 210,
      lifetimeMs: 6000,
      destroyOnHit: false,
      targetHitCooldownMs: 120,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.75, g: 0.78, b: 0.82, a: 1 },
      },
      shape: "sprite",
      spriteName: "axe_bullet",
      rotationSpinningDegPerSec: 900,
      hitRadius: 22,
      damageRadius: 32,
      explosion: "bleedSplash",
      ringTrail: {
        spawnIntervalMs: 50,
        lifetimeMs: 900,
        startRadius: 8,
        endRadius: 28,
        startAlpha: 0.08,
        endAlpha: 0,
        innerStop: 0.46,
        outerStop: 0.76,
        color: { r: 0.6, g: 0.62, b: 0.68, a: 0.1 },
      },
      tail: {
        lengthMultiplier: 3.8,
        widthMultiplier: 1.05,
        startColor: { r: 0.82, g: 0.84, b: 0.9, a: 0.25 },
        endColor: { r: 0.45, g: 0.5, b: 0.62, a: 0 },
      },
    },
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.08,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75,
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.55, g: 0.58, b: 0.62, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.6, g: 0.63, b: 0.68, a: 0.1 } },
          { offset: 0.25, color: { r: 0.6, g: 0.63, b: 0.68, a: 0.05 } },
          { offset: 1, color: { r: 0.6, g: 0.63, b: 0.68, a: 0 } },
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
    targeting: {
      avoidSharedTargets: true,
      searchPadding: 320,
    },
    knockBackDistance: 160,
    knockBackSpeed: 170,
    projectileKnockBackDistance: 10,
    projectileKnockBackSpeed: 15,
  },
  bigGun: {
    name: "Big Gun",
    renderer: {
      kind: "composite",
      fill: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -3 },
            { x: 0, y: -5 },
            { x: 0, y: 5 },
            { x: 14, y: 3 },
          ],
          fill: { type: "base", brightness: 0.2 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -4 },
            { x: -3, y: -8 },
            { x: -8, y: -8 },
            { x: -11, y: -4 },
            { x: -11, y: 4 },
            { x: -8, y: 8},
            { x: -3, y: 8 },
            { x: 0, y: 4}
          ],
          fill: { type: "base", brightness: 0.2 },
        },
      ],
    },
    maxHp: 725,
    armor: 48,
    baseDamage: 90,
    attackInterval: 3.5,
    attackRange: 300,
    moveSpeed: 0, // Статична турель
    physicalSize: 30,
    reward: normalizeResourceAmount({
      iron: 50,
      copper: 10,
    }),
    projectile: {
      radius: 8,
      speed: 80,
      lifetimeMs: 4500,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
      },
      shape: "circle",
      hitRadius: 60,
      damageRadius: 90,
      explosion: "bigCannon",
      tail: {
        lengthMultiplier: 4.0,
        widthMultiplier: 1.0,
        startColor: { r: 0.5, g: 0.6, b: 0.6, a: 0.11 },
        endColor: { r: 0.5, g: 0.6, b: 0.6, a: 0 },
      },
      tailEmitter: {
        particlesPerSecond: 150,
        particleLifetimeMs: 800,
        fadeStartMs: 100,
        baseSpeed: 0.03,
        speedVariation: 0.005,
        spread: Math.PI / 8,
        sizeEvolutionMult: 3.0,
        sizeRange: { min: 10.3, max: 14.4 },
        color: { r: 0.5, g: 0.6, b: 0.6, a: 1 },
        fill: {
          fillType: FILL_TYPES.RADIAL_GRADIENT,
          stops: [
            { offset: 0, color: { r: 0.5, g: 0.6, b: 0.6, a: 0.1 } },
            { offset: 1, color: { r: 0.5, g: 0.6, b: 0.6, a: 0 } },
          ],
          noise: {
            colorAmplitude: 0.0,
            alphaAmplitude: 0.02,
            scale: 0.45,
          }
        },
        maxParticles: 200,
      },
    },
    knockBackDistance: 120,
    knockBackSpeed: 130,
  },
  laserTurretEnemy: {
    knockBackDistance: 160,
    knockBackSpeed: 160,
    name: "Laser Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.15, g: 0.15, b: 0.25, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 14, y: -2 },
            { x: 0, y: -2.5 },
            { x: 0, y: 2.5 },
            { x: 14, y: 2 },
          ],
          fill: { type: "base", brightness: -0.25 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -5 },
            { x: -9, y: -7 },
            { x: -9, y: 7 },
            { x: 0, y: 5 },
          ],
          fill: { type: "base", brightness: 0.7 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: -6 },
            { x: -6, y: -17 },
            { x: -8, y: -17 },
            { x: -8, y: -6 },
          ],
          fill: { type: "base", brightness: 0.5 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -3, y: 6 },
            { x: -6, y: 17 },
            { x: -8, y: 17 },
            { x: -8, y: 6 },
          ],
          fill: { type: "base", brightness: 0.5 },
        },
      ],
    },
    maxHp: 14000,
    armor: 140,
    baseDamage: 350,
    attackInterval: 1.8,
    attackRange: 1600,
    moveSpeed: 0,
    physicalSize: 26,
    reward: normalizeResourceAmount({
      iron: 30,
      coal: 5,
    }),
    arcAttack: {
      arcType: "laser",
      explosionType: "smallLaser",
      explosionRadius: 21,
      spawnOffset: { x: 1, y: 0 },
    },
  },
  plasmaBeamTurretEnemy: {
    knockBackDistance: 180,
    knockBackSpeed: 180,
    name: "Plasma Beam Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.1, g: 0.15, b: 0.75, a: 1 },
      layers: [
        {
          shape: "polygon",
          vertices: [
            { x: 19, y: -5 },
            { x: 0, y: -5 },
            { x: 0, y: 5 },
            { x: 19, y: 5 },
          ],
          fill: { type: "base", brightness: -0.35 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -6 },
            { x: -10, y: -9 },
            { x: -10, y: 9 },
            { x: 0, y: 6 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: -7 },
            { x: -3, y: -14 },
            { x: -9, y: -14 },
            { x: -9, y: -7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: -12 },
            { x: 0, y: -19 },
            { x: -9, y: -19 },
            { x: -14, y: -12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: 7 },
            { x: -3, y: 14 },
            { x: -9, y: 14 },
            { x: -9, y: 7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: 12 },
            { x: 0, y: 19 },
            { x: -9, y: 19 },
            { x: -14, y: 12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
      ],
    },
    maxHp: 56500,
    armor: 1165,
    baseDamage: 480,
    attackInterval: 2.1,
    attackRange: 650,
    moveSpeed: 0,
    physicalSize: 28,
    reward: normalizeResourceAmount({
      copper: 80,
    }),
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.08,
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
          { offset: 0, color: { r: 0.6, g: 0.75, b: 1, a: 0.1 } },
          { offset: 0.25, color: { r: 0.6, g: 0.75, b: 1, a: 0.05 } },
          { offset: 1, color: { r: 0.6, g: 0.75, b: 1, a: 0 } },
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
    arcAttack: {
      arcType: "plasmaBeam",
      explosionType: "plasmaBeam",
      explosionRadius: 36,
      spawnOffset: { x: 2, y: 0 },
    },
  },
  plasmaStormTurretEnemy: {
    knockBackDistance: 180,
    knockBackSpeed: 180,
    name: "Plasma Storm Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.12, g: 0.18, b: 0.65, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 36,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              stops: [
                { offset: 0, color: { r: 0.4, g: 0.6, b: 1.0, a: 0.5 } },
                { offset: 0.6, color: { r: 0.25, g: 0.4, b: 0.9, a: 0.25 } },
                { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0 } },
              ],
            },
          },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 19, y: -5 },
            { x: 0, y: -5 },
            { x: 0, y: 5 },
            { x: 19, y: 5 },
          ],
          fill: { type: "base", brightness: -0.35 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 0, y: -6 },
            { x: -10, y: -9 },
            { x: -10, y: 9 },
            { x: 0, y: 6 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: -7 },
            { x: -3, y: -14 },
            { x: -9, y: -14 },
            { x: -9, y: -7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: -12 },
            { x: 0, y: -19 },
            { x: -9, y: -19 },
            { x: -14, y: -12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: -2, y: 7 },
            { x: -3, y: 14 },
            { x: -9, y: 14 },
            { x: -9, y: 7 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 9, y: 12 },
            { x: 0, y: 19 },
            { x: -9, y: 19 },
            { x: -14, y: 12 },
          ],
          fill: { type: "base", brightness: 0.55 },
        },
      ],
    },
    maxHp: 56500,
    armor: 1165,
    baseDamage: 480,
    attackInterval: 2.1,
    attackRange: 650,
    moveSpeed: 0,
    physicalSize: 28,
    reward: normalizeResourceAmount({
      copper: 80,
    }),
    emitter: {
      particlesPerSecond: 90,
      particleLifetimeMs: 750,
      fadeStartMs: 200,
      baseSpeed: 0.08,
      speedVariation: 0.01,
      sizeRange: { min: 14.2, max: 28.4 },
      sizeEvolutionMult: 1.75,
      spread: Math.PI / 5.5,
      offset: { x: -0.75, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.4 },
      fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        start: { x: 0, y: 0 },
        stops: [
          { offset: 0, color: { r: 0.6, g: 0.75, b: 1, a: 0.1 } },
          { offset: 0.25, color: { r: 0.6, g: 0.75, b: 1, a: 0.05 } },
          { offset: 1, color: { r: 0.6, g: 0.75, b: 1, a: 0 } },
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
    arcAttack: {
      arcType: "plasmaStorm",
      explosionType: "plasmaBeam",
      explosionRadius: 36,
      spawnOffset: { x: 2, y: 0 },
    },
  },
  hotCorridorTurretEnemy: {
    name: "Hot Corridor Turret",
    renderer: {
      kind: "composite",
      fill: { r: 0.85, g: 0.35, b: 0.15, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 32,
          segments: 40,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 32,
              stops: [
                { offset: 0, color: { r: 1, g: 0.75, b: 0.35, a: 0.5 } },
                { offset: 0.65, color: { r: 0.95, g: 0.35, b: 0.12, a: 0.28 } },
                { offset: 1, color: { r: 0.7, g: 0.15, b: 0.08, a: 0 } },
              ],
            },
          },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 18, y: -4 },
            { x: 4, y: -6 },
            { x: 4, y: 6 },
            { x: 18, y: 4 },
          ],
          fill: { type: "base", brightness: -0.1 },
        },
        {
          shape: "polygon",
          vertices: [
            { x: 4, y: -8 },
            { x: -11, y: -12 },
            { x: -11, y: 12 },
            { x: 4, y: 8 },
          ],
          fill: { type: "base", brightness: 0.18 },
        },
      ],
      auras: [
        {
          petalCount: 12,
          innerRadius: 20,
          outerRadius: 34,
          petalWidth: 0.5,
          rotationSpeed: 0.4,
          color: { r: 1, g: 0.55, b: 0.2, a: 0.25 },
          alpha: 0.22,
        },
      ],
    },
    maxHp: 198000,
    armor: 4900,
    baseDamage: 4500,
    attackInterval: 2.2,
    attackRange: 560,
    moveSpeed: 0,
    physicalSize: 32,
    reward: normalizeResourceAmount({
      copper: 120,
      coal: 50,
      stone: 85,
    }),
    arcAttack: {
      arcType: "hotPlasmaBeam",
      explosionType: "hotPlasmaExplosion",
      explosionRadius: 52,
      spawnOffset: { x: 14, y: 0 },
      statusEffectId: "burn",
      statusEffectOptions: {
        damagePerSecond: 1236,
        durationMs: 3500,
      },
    },
    knockBackDistance: 160,
    knockBackSpeed: 190,
  },
};
