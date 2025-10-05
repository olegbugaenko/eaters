import { BrickType } from "./bricks-db";
import { SceneSize, SceneVector2 } from "../logic/services/SceneObjectManager";
import { PlayerUnitType } from "./player-units-db";
import {
  BrickShapeBlueprint,
  buildBricksFromBlueprints,
  circleWithBricks,
} from "../logic/services/BrickLayoutService";

export type MapId = "initial";

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: readonly BrickShapeBlueprint[];
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
    bricks: (() => {
      const center: SceneVector2 = { x: 2000, y: 2000 };
      const largeCircle = circleWithBricks("smallSquareGray", {
        center,
        innerRadius: 0,
        outerRadius: 500,
      });

      const satelliteCount = 10;
      const satelliteRadius = 125;
      const orbitRadius = 500 + 200 + satelliteRadius;

      const satellites = Array.from({ length: satelliteCount }, (_, index) => {
        const angle = (index / satelliteCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadius,
          y: center.y + Math.sin(angle) * orbitRadius,
        };
        return circleWithBricks("smallSquareGray", {
          center: position,
          innerRadius: 0,
          outerRadius: satelliteRadius,
        });
      });

      return [largeCircle, ...satellites];
    })(),
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
    const bricks = buildBricksFromBlueprints(config.bricks);
    const brickCount = bricks.length;
    const brickTypes = Array.from(new Set(bricks.map((brick) => brick.type)));
    return {
      id: mapId,
      name: config.name,
      size: { ...config.size },
      brickCount,
      brickTypes,
    };
  });
