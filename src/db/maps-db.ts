import { BrickType, getBrickConfig } from "./bricks-db";
import { SceneSize, SceneVector2 } from "../logic/services/SceneObjectManager";
import { PlayerUnitType } from "./player-units-db";
import {
  BrickShapeBlueprint,
  buildBricksFromBlueprints,
  circleWithBricks,
  polygonWithBricks,
} from "../logic/services/BrickLayoutService";

export type MapId = "foundations" | "initial";

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: readonly BrickShapeBlueprint[];
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
  readonly spawnPoints?: readonly SceneVector2[];
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

const FOUNDATIONS_CENTER: SceneVector2 = { x: 500, y: 500 };

const MAPS_DB: Record<MapId, MapConfig> = {
  foundations: (() => {
    const center = FOUNDATIONS_CENTER;
    const size: SceneSize = { width: 1000, height: 1000 };
    const spawnPoint: SceneVector2 = { x: center.x, y: center.y };
    const sides = 5;
    const outerRadius = 360;
    const layerThickness = getBrickConfig("smallSquareGray").size.width * 3;
    const innerRadius = Math.max(outerRadius - layerThickness, 0);

    const createPolygon = (radius: number): SceneVector2[] =>
      Array.from({ length: sides }, (_, index) => {
        const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
        return {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      });

    const outerVertices = createPolygon(outerRadius);
    const innerVertices = createPolygon(innerRadius);

    const ring = polygonWithBricks("smallSquareGray", {
      vertices: outerVertices,
      holes: [innerVertices],
      offsetX: center.x,
      offsetY: center.y,
    });

    return {
      name: "Cracked Pentagon",
      size,
      spawnPoints: [spawnPoint],
      bricks: [ring],
      playerUnits: [
        {
          type: "bluePentagon",
          position: { x: 140, y: 140 },
        },
      ],
    } satisfies MapConfig;
  })(),
  initial: {
    name: "Initial Grounds",
    size: { width: 3000, height: 3000 },
    bricks: (() => {
      const center: SceneVector2 = { x: 1500, y: 1500 };
      const largeCircle = circleWithBricks("smallSquareGray", {
        center,
        innerRadius: 300,
        outerRadius: 500,
      });

      const largeYellowCircle = circleWithBricks("smallSquareYellow", {
        center,
        innerRadius: 0,
        outerRadius: 300,
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
          innerRadius: satelliteRadius*0.5,
          outerRadius: satelliteRadius,
        });
      });

      const satellitesInner = Array.from({ length: satelliteCount }, (_, index) => {
        const angle = (index / satelliteCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadius,
          y: center.y + Math.sin(angle) * orbitRadius,
        };
        return circleWithBricks("smallSquareYellow", {
          center: position,
          innerRadius: 0,
          outerRadius: satelliteRadius*0.5,
        });
      });

      const satelliteCountOuter = 32;
      const satelliteRadiusOuter = 100;
      const orbitRadiusOuter = 500 + 700 + satelliteRadius;

      const satellitesOuter = Array.from({ length: satelliteCountOuter }, (_, index) => {
        const angle = (index / satelliteCountOuter) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadiusOuter,
          y: center.y + Math.sin(angle) * orbitRadiusOuter,
        };
        return circleWithBricks("smallSquareGray", {
          center: position,
          innerRadius: 0,
          outerRadius: satelliteRadiusOuter,
        });
      });

      return [largeCircle, largeYellowCircle, ...satellites, ...satellitesInner, ...satellitesOuter];
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
