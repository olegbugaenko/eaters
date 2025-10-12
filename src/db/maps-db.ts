import { BrickType, getBrickConfig } from "./bricks-db";
import { SceneSize, SceneVector2 } from "../logic/services/SceneObjectManager";
import { PlayerUnitType } from "./player-units-db";
import type { UnlockCondition } from "../types/unlocks";
import type { SkillId } from "./skills-db";
import {
  BrickShapeBlueprint,
  buildBricksFromBlueprints,
  circleWithBricks,
  polygonWithBricks,
} from "../logic/services/BrickLayoutService";

export type MapId = "foundations" | "initial";

export interface MapBrickGeneratorOptions {
  readonly mapLevel: number;
}

export type MapBrickGenerator = (
  options: MapBrickGeneratorOptions
) => readonly BrickShapeBlueprint[];

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: MapBrickGenerator;
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
  readonly spawnPoints?: readonly SceneVector2[];
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
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

    return {
      name: "Cracked Pentagon",
      size,
      spawnPoints: [spawnPoint],
      bricks: ({ mapLevel }) => [
        polygonWithBricks(
          "smallSquareGray",
          {
            vertices: outerVertices,
            holes: [innerVertices],
            offsetX: center.x,
            offsetY: center.y,
          },
          { level: mapLevel }
        ),
      ],
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
    } satisfies MapConfig;
  })(),
  initial: {
    name: "Initial Grounds",
    size: { width: 2500, height: 2500 },
    unlockedBy: [
      {
        type: "map",
        id: "foundations",
        level: 1,
      },
    ],
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const innerLevel = baseLevel + 1;
      const center: SceneVector2 = { x: 1250, y: 1250 };
      const largeCircle = circleWithBricks(
        "smallSquareGray",
        {
          center,
          innerRadius: 460,
          outerRadius: 500,
        },
        { level: innerLevel }
      );

      const largeYellowCircle = circleWithBricks(
        "smallSquareYellow",
        {
          center,
          innerRadius: 320,
          outerRadius: 460,
        },
        { level: baseLevel }
      );

      const satelliteCount = 10;
      const satelliteRadius = 125;
      const orbitRadius = 500 + 200 + satelliteRadius;

      const satellites = Array.from({ length: satelliteCount }, (_, index) => {
        const angle = (index / satelliteCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadius,
          y: center.y + Math.sin(angle) * orbitRadius,
        };
        return circleWithBricks(
          "smallSquareGray",
          {
            center: position,
            innerRadius: satelliteRadius * 0.5,
            outerRadius: satelliteRadius,
          },
          { level: baseLevel + 0.5 }
        );
      });

      const satellitesInner = Array.from({ length: satelliteCount }, (_, index) => {
        const angle = (index / satelliteCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadius,
          y: center.y + Math.sin(angle) * orbitRadius,
        };
        return circleWithBricks(
          "smallSquareYellow",
          {
            center: position,
            innerRadius: 0,
            outerRadius: satelliteRadius * 0.5,
          },
          { level: baseLevel }
        );
      });

      /*const satelliteCountOuter = 32;
      const satelliteRadiusOuter = 100;
      const orbitRadiusOuter = 500 + 700 + satelliteRadius;

      const satellitesOuter = Array.from({ length: satelliteCountOuter }, (_, index) => {
        const angle = (index / satelliteCountOuter) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * orbitRadiusOuter,
          y: center.y + Math.sin(angle) * orbitRadiusOuter,
        };
        return circleWithBricks(
          "smallSquareGray",
          {
            center: position,
            innerRadius: 0,
            outerRadius: satelliteRadiusOuter,
          },
          { level: baseLevel + 0.25 }
        );
      });
      */
      return [largeCircle, largeYellowCircle, ...satellites, ...satellitesInner];
    },
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
    const bricks = buildBricksFromBlueprints(config.bricks({ mapLevel: 0 }));
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
