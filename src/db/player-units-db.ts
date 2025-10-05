import { SceneColor, SceneFill, SceneVector2 } from "../logic/services/SceneObjectManager";
import { ResourceCost } from "../types/resources";

export type PlayerUnitType = "bluePentagon";

export interface PlayerUnitRendererPolygonConfig {
  kind: "polygon";
  vertices: readonly SceneVector2[];
  fill: SceneColor;
  stroke?: {
    color: SceneColor;
    width: number;
  };
  offset?: SceneVector2;
}

export type PlayerUnitRendererConfig = PlayerUnitRendererPolygonConfig;

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
  readonly emitter?: PlayerUnitEmitterConfig;
  readonly cost: ResourceCost;
}

const BLUE_PENTAGON_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -6 },
  { x: 17/3, y: -2 },
  { x: 11/3, y: 16/3 },
  { x: -11/3, y: 16/3 },
  { x: -17/3, y: -2 },
];

const PLAYER_UNITS_DB: Record<PlayerUnitType, PlayerUnitConfig> = {
  bluePentagon: {
    name: "Blue Vanguard",
    renderer: {
      kind: "polygon",
      vertices: BLUE_PENTAGON_VERTICES,
      fill: { r: 0.2, g: 0.75, b: 0.95, a: 1 },
      stroke: {
        color: { r: 0.05, g: 0.15, b: 0.4, a: 1 },
        width: 2,
      },
      offset: { x: 0, y: 0 },
    },
    maxHp: 40,
    armor: 1,
    baseAttackDamage: 2,
    baseAttackInterval: 1,
    baseAttackDistance: 5,
    moveSpeed: 80,
    moveAcceleration: 30,
    mass: 1.2,
    physicalSize: 12,
    emitter: {
      particlesPerSecond: 120,
      particleLifetimeMs: 550,
      fadeStartMs: 300,
      baseSpeed: 0.15,
      speedVariation: 0.03,
      sizeRange: { min: 1.2, max: 2.4 },
      spread: Math.PI / 5.5,
      offset: { x: -0.35, y: 0 },
      color: { r: 0.2, g: 0.85, b: 0.95, a: 0.35 },
      maxParticles: 80,
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
