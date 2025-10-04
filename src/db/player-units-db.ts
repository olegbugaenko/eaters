import { SceneColor, SceneVector2 } from "../logic/services/SceneObjectManager";

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

export interface PlayerUnitConfig {
  readonly name: string;
  readonly renderer: PlayerUnitRendererConfig;
  readonly maxHp: number;
  readonly armor: number;
  readonly baseAttackDamage: number;
  readonly baseAttackInterval: number; // seconds
  readonly baseAttackDistance: number;
  readonly moveSpeed: number; // units per second
}

const BLUE_PENTAGON_VERTICES: readonly SceneVector2[] = [
  { x: 0, y: -18 },
  { x: 17, y: -6 },
  { x: 11, y: 16 },
  { x: -11, y: 16 },
  { x: -17, y: -6 },
];

const PLAYER_UNITS_DB: Record<PlayerUnitType, PlayerUnitConfig> = {
  bluePentagon: {
    name: "Blue Vanguard",
    renderer: {
      kind: "polygon",
      vertices: BLUE_PENTAGON_VERTICES,
      fill: { r: 0.2, g: 0.45, b: 0.95, a: 1 },
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
    moveSpeed: 15,
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
