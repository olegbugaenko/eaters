import { BrickType } from "./bricks-db";
import { SceneSize, SceneVector2 } from "../logic/services/SceneObjectManager";
import { PlayerUnitType } from "./player-units-db";

export type MapId = "initial";

export interface MapBrickGroupConfig {
  readonly type: BrickType;
  readonly count: number;
}

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: readonly MapBrickGroupConfig[];
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
}

export interface MapListEntry {
  readonly id: MapId;
  readonly name: string;
  readonly size: SceneSize;
  readonly brickCount: number;
  readonly brickTypes: readonly BrickType[];
}

export interface MapPlayerUnitConfig {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
}

const MAPS_DB: Record<MapId, MapConfig> = {
  initial: {
    name: "Initial Grounds",
    size: { width: 4000, height: 4000 },
    bricks: [
      {
        type: "smallSquareGray",
        count: 2000,
      },
    ],
    playerUnits: [
      {
        type: "bluePentagon",
        position: { x: 100, y: 100 },
      },
    ],
  },
};

export const MAP_IDS = Object.keys(MAPS_DB) as MapId[];

export const getMapConfig = (mapId: MapId): MapConfig => {
  const config = MAPS_DB[mapId];
  if (!config) {
    throw new Error(`Unknown map: ${mapId}`);
  }
  return config;
};

export const isMapId = (value: unknown): value is MapId =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(MAPS_DB, value);

export const getMapList = (): MapListEntry[] =>
  MAP_IDS.map((mapId) => {
    const config = MAPS_DB[mapId];
    const brickCount = config.bricks.reduce((total, group) => total + group.count, 0);
    const brickTypes = Array.from(new Set(config.bricks.map((group) => group.type)));
    return {
      id: mapId,
      name: config.name,
      size: { ...config.size },
      brickCount,
      brickTypes,
    };
  });
