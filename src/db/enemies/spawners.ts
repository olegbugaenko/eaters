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

export const SPAWNERS_ENEMIES: Partial<Record<EnemyType, EnemyConfig>> = {
  portalSpawnerEnemy: {
    name: "Portal Spawner",
    renderer: {
      kind: "composite",
      fill: { r: 0.65, g: 0.6, b: 0.7, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 47,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.84, g: 0.81, b: 0.95, a: 0.1 } },
                { offset: 0.75, color: { r: 0.84, g: 0.81, b: 0.95, a: 0.9 } },
                { offset: 1, color: { r: 0.84, g: 0.81, b: 0.95, a: 0 } },
              ],
            }
          }
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -44.8, width: 10 },
            { x: 38.8, y: -22.4, width: 10 },
            { x: 38.8, y: 22.4, width: 10 },
            { x: 0, y: 44.8, width: 10 },
            { x: -38.8, y: 22.4, width: 10 },
            { x: -38.8, y: -22.4, width: 10 },
            { x: 0, y: -44.8, width: 10 },
          ],          
          {
            fill: { type: "base", brightness: 0.1 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
      ],
    },
    maxHp: 50000,
    armor: 5000,
    baseDamage: 0,
    attackInterval: 9999,
    attackRange: 0,
    moveSpeed: 0,
    physicalSize: 32,
    lockRotation: true,
    requireDestruction: true,
    spawner: {
      spawnRate: 0.2,
      enemyTypes: [
        {
          type: "silverKeeperEnemy",
          weight: 1,
        },
      ],
      maxConcurrent: 3,
    },
    reward: normalizeResourceAmount({
      silver: 150,
    }),
    emitter: {
      color: { r: 0.9, g: 0.6, b: 0.9, a: 0.9 },
      particlesPerSecond: 190,
      particleLifetimeMs: 650,
      fadeStartMs: 500,
      baseSpeed: 0.09,
      speedVariation: 0.01,
      sizeRange: { min: 3, max: 5 },
      sizeEvolutionMult: 1.0,
      shape: "triangle",
      maxParticles: 1000,
      spread: Math.PI * 2,
      /*fill: {
        fillType: FILL_TYPES.RADIAL_GRADIENT,
        stops: [
          { offset: 0, color: { r: 0.9, g: 0.8, b: 0.9, a: 0.4 } },
          { offset: 0.25, color: { r: 0.9, g: 0.8, b: 0.9, a: 0.15 } },
          { offset: 1, color: { r: 0.9, g: 0.8, b: 0.9, a: 0 } },
        ],
      },*/
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.97, g: 0.94, b: 1, a: 0.9 },
      },
    },
  },
  bronzeArcherPortalSpawnerEnemy: {
    name: "Bronze Archer Portal",
    renderer: {
      kind: "composite",
      fill: { r: 0.55, g: 0.42, b: 0.25, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 47,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.9, g: 0.7, b: 0.5, a: 0.1 } },
                { offset: 0.75, color: { r: 0.9, g: 0.7, b: 0.5, a: 0.9 } },
                { offset: 1, color: { r: 0.9, g: 0.7, b: 0.5, a: 0 } },
              ],
            },
          },
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -44.8, width: 10 },
            { x: 38.8, y: -22.4, width: 10 },
            { x: 38.8, y: 22.4, width: 10 },
            { x: 0, y: 44.8, width: 10 },
            { x: -38.8, y: 22.4, width: 10 },
            { x: -38.8, y: -22.4, width: 10 },
            { x: 0, y: -44.8, width: 10 },
          ],
          {
            fill: { type: "base", brightness: 0.1 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
      ],
    },
    maxHp: 45000,
    armor: 4000,
    baseDamage: 0,
    attackInterval: 9999,
    attackRange: 0,
    moveSpeed: 0,
    physicalSize: 32,
    lockRotation: true,
    requireDestruction: true,
    spawner: {
      spawnRate: 0.18,
      enemyTypes: [
        {
          type: "bronzeArcherEnemy",
          weight: 1,
        },
      ],
      maxConcurrent: 3,
    },
    reward: normalizeResourceAmount({
      copper: 1000,
      silver: 200,
    }),
    soulRewardBase: 5,
    emitter: {
      color: { r: 0.9, g: 0.7, b: 0.5, a: 0.9 },
      particlesPerSecond: 170,
      particleLifetimeMs: 600,
      fadeStartMs: 450,
      baseSpeed: 0.085,
      speedVariation: 0.01,
      sizeRange: { min: 3, max: 5 },
      sizeEvolutionMult: 1.0,
      shape: "triangle",
      maxParticles: 900,
      spread: Math.PI * 2,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.95, g: 0.8, b: 0.6, a: 0.9 },
      },
    },
  },
  carGuardianPortalSpawnerEnemy: {
    name: "Car Guardian Portal",
    renderer: {
      kind: "composite",
      fill: { r: 0.75, g: 0.65, b: 0.55, a: 1 },
      layers: [
        {
          shape: "circle",
          radius: 47,
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              stops: [
                { offset: 0, color: { r: 0.75, g: 0.75, b: 0.8, a: 0.1 } },
                { offset: 0.75, color: { r: 0.75, g: 0.75, b: 0.8, a: 0.9 } },
                { offset: 1, color: { r: 0.75, g: 0.75, b: 0.8, a: 0 } },
              ],
            },
          },
        },
        ...mapLineToPolygonShape<
          Omit<EnemyRendererLayerConfig, "shape" | "vertices">
        >(
          [
            { x: 0, y: -44.8, width: 10 },
            { x: 38.8, y: -22.4, width: 10 },
            { x: 38.8, y: 22.4, width: 10 },
            { x: 0, y: 44.8, width: 10 },
            { x: -38.8, y: 22.4, width: 10 },
            { x: -38.8, y: -22.4, width: 10 },
            { x: 0, y: -44.8, width: 10 },
          ],
          {
            fill: { type: "base", brightness: 0.1 },
          },
          { epsilon: 0.25, winding: "CCW" }
        ),
      ],
    },
    maxHp: 225000,
    armor: 3800,
    baseDamage: 0,
    attackInterval: 9999,
    attackRange: 0,
    moveSpeed: 0,
    physicalSize: 32,
    lockRotation: true,
    requireDestruction: true,
    spawner: {
      spawnRate: 0.16,
      enemyTypes: [
        {
          type: "carGuardian",
          weight: 1,
        },
      ],
      maxConcurrent: 3,
    },
    reward: normalizeResourceAmount({
      coal: 200,
    }),
    soulRewardBase: 4,
    emitter: {
      color: { r: 0.7, g: 0.7, b: 0.75, a: 0.9 },
      particlesPerSecond: 160,
      particleLifetimeMs: 580,
      fadeStartMs: 440,
      baseSpeed: 0.08,
      speedVariation: 0.01,
      sizeRange: { min: 3, max: 5 },
      sizeEvolutionMult: 1.0,
      shape: "triangle",
      maxParticles: 850,
      spread: Math.PI * 2,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { r: 0.85, g: 0.85, b: 0.88, a: 0.9 },
      },
    },
  },
};
