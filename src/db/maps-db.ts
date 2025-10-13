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

export type MapId = "foundations" | "initial" | "thicket" | "oldForge";

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
    size: { width: 1500, height: 1500 },
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
      const center: SceneVector2 = { x: 750, y: 750 };
      const largeCircle = circleWithBricks(
        "smallSquareGray",
        {
          center,
          innerRadius: 250,
          outerRadius: 290,
        },
        { level: innerLevel }
      );

      const largeYellowCircle = circleWithBricks(
        "smallSquareYellow",
        {
          center,
          innerRadius: 160,
          outerRadius: 250,
        },
        { level: baseLevel }
      );

      const satelliteCount = 8;
      const satelliteRadius = 100;
      const orbitRadius = 400 + satelliteRadius;

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
            innerRadius: satelliteRadius * 0.6,
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
            outerRadius: satelliteRadius * 0.6,
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
  thicket: (() => {
    const size: SceneSize = { width: 1000, height: 1000 };
    const sandHeight = 60;
    const createRectangle = (
      x: number,
      y: number,
      width: number,
      height: number
    ): SceneVector2[] => [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
    const sandVertices = createRectangle(0, size.height - sandHeight, size.width, sandHeight);
    const bushClusters: readonly { center: SceneVector2; radius: number }[] = [
      { center: { x: 320, y: 760 }, radius: 110 },
      { center: { x: 500, y: 640 }, radius: 100 },
      { center: { x: 720, y: 700 }, radius: 105 },
      { center: { x: 880, y: 560 }, radius: 115 },
      { center: { x: 620, y: 820 }, radius: 90 },
    ];

    return {
      name: "Overgrown Thicket",
      size,
      spawnPoints: [{ x: 50, y: size.height - sandHeight - 220 }],
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const sandLevel = baseLevel + 1;
        const organicLevel = baseLevel;

        const sandBank = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: sandVertices,
          },
          { level: sandLevel }
        );

        const bushes = bushClusters.map((cluster) =>
          circleWithBricks(
            "smallOrganic",
            {
              center: cluster.center,
              innerRadius: 0,
              outerRadius: cluster.radius,
            },
            { level: organicLevel }
          )
        );

        return [sandBank, ...bushes];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { x: 50, y: size.height - sandHeight - 220 },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "initial",
          level: 1,
        },
      ],
    } satisfies MapConfig;
  })(),
  oldForge: (() => {
    const size: SceneSize = { width: 1000, height: 1000 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const outerSize = 700;
    const cavitySize = 500;
    const createSquareVertices = (squareSize: number): SceneVector2[] => {
      const half = squareSize / 2;
      return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half },
      ];
    };

    return {
      name: "Old Forge",
      size,
      spawnPoints: [{ x: center.x, y: center.y - outerSize / 2 + 80 }],
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const walkwayLevel = baseLevel + 1;
        const ironThickness = getBrickConfig("smallIron").size.width;
        const innerRingSize = Math.max(cavitySize - ironThickness * 8, 0);

        const forgeFloor = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createSquareVertices(outerSize),
            holes: [createSquareVertices(cavitySize)],
          },
          { level: walkwayLevel }
        );

        const ironLining = polygonWithBricks(
          "smallIron",
          {
            vertices: createSquareVertices(cavitySize),
            holes: innerRingSize > 0 ? [createSquareVertices(innerRingSize)] : undefined,
          },
          { level: baseLevel }
        );

        return [forgeFloor, ironLining];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { x: center.x, y: center.y - outerSize / 2 + 80 },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "initial",
          level: 1,
        },
      ],
    } satisfies MapConfig;
  })(),
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
