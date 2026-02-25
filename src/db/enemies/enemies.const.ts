import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export const BASIC_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -12 },
  { x: 8, y: -6 },
  { x: 8, y: 6 },
  { x: 0, y: 12 },
  { x: -8, y: 6 },
  { x: -8, y: -6 },
];

export const FAST_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -10 },
  { x: 6, y: -5 },
  { x: 6, y: 5 },
  { x: 0, y: 10 },
  { x: -6, y: 5 },
  { x: -6, y: -5 },
];

export const TANK_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -16 },
  { x: 12, y: -8 },
  { x: 12, y: 8 },
  { x: 0, y: 16 },
  { x: -12, y: 8 },
  { x: -12, y: -8 },
];

export const TURRET_ENEMY_VERTICES_FB: readonly SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 14, y: -10 },
  { x: 14, y: 10 },
  { x: 0, y: 18 },
  { x: -14, y: 10 },
  { x: -14, y: -10 },
];

export const TURRET_ENEMY_VERTICES: readonly SceneVector2[] = [
  { x: 14, y: -2 },
  { x: -14, y: -10 },
  { x: -14, y: 10 },
  { x: 14, y: 2 },
];

export const PORTAL_SPAWNER_VERTICES: readonly SceneVector2[] = [
  { x: -16, y: -16 },
  { x: 16, y: -16 },
  { x: 16, y: 16 },
  { x: -16, y: 16 },
];
