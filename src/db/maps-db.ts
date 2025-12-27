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

export type MapId =
  | "trainingGrounds"
  | "foundations"
  | "initial"
  | "thicket"
  | "oldForge"
  | "spruce"
  | "sphinx"
  | "stoneCottage"
  | "wire"
  | "mine"
  | "adit"
  | "silverRing"
  | "frozenForest"
  | "volcano";

export interface MapBrickGeneratorOptions {
  readonly mapLevel: number;
}

export type MapBrickGenerator = (
  options: MapBrickGeneratorOptions
) => readonly BrickShapeBlueprint[];

export interface MapNodePosition {
  readonly x: number;
  readonly y: number;
}

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: MapBrickGenerator;
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
  readonly spawnPoints?: readonly SceneVector2[];
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
  readonly nodePosition: MapNodePosition;
  readonly mapsRequired?: Partial<Record<MapId, number>>;
  readonly maxLevel: number;
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
  trainingGrounds: (() => {
    const center: SceneVector2 = { x: 500, y: 600 };
    const size: SceneSize = { width: 1000, height: 1000 };
    const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 500 };

    // Голова смайлика
    const headRadius = 280;
    const headThickness = 20;

    // Очі
    const eyeRadius = 35;
    const eyeOffsetY = -60;
    const eyeOffsetX = 80;

    // Рот (дуга) - створюємо через сегменти кіл
    const mouthRadius = 120;
    const mouthThickness = headThickness;
    const mouthCenterY = center.y + 50;
    const mouthStartAngle = Math.PI * 0.25; // ~45 градусів
    const mouthEndAngle = Math.PI * 0.75; // ~135 градусів
    const mouthSegments = 8; // кількість сегментів для рота

    return {
      name: "Training Grounds",
      size,
      spawnPoints: [spawnPoint],
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));

        // Голова (зовнішнє коло)
        const headOuter = circleWithBricks(
          "smallTrainingBrick",
          {
            center,
            innerRadius: headRadius - headThickness,
            outerRadius: headRadius,
          },
          { level: baseLevel }
        );

        // Ліве око
        const leftEye = circleWithBricks(
          "smallTrainingBrick",
          {
            center: { x: center.x - eyeOffsetX, y: center.y + eyeOffsetY },
            innerRadius: 0,
            outerRadius: eyeRadius,
          },
          { level: baseLevel }
        );

        // Праве око
        const rightEye = circleWithBricks(
          "smallTrainingBrick",
          {
            center: { x: center.x + eyeOffsetX, y: center.y + eyeOffsetY },
            innerRadius: 0,
            outerRadius: eyeRadius,
          },
          { level: baseLevel }
        );

        // Рот (дуга) - створюємо через сегменти кіл
        const mouthSegmentsArray = Array.from({ length: mouthSegments }, (_, i) => {
          const t = i / (mouthSegments - 1);
          const angle = mouthStartAngle + (mouthEndAngle - mouthStartAngle) * t;
          const segmentCenter: SceneVector2 = {
            x: center.x + Math.cos(angle) * mouthRadius,
            y: mouthCenterY + Math.sin(angle) * mouthRadius,
          };
          return circleWithBricks(
            "smallTrainingBrick",
            {
              center: segmentCenter,
              innerRadius: 0,
              outerRadius: mouthThickness,
            },
            { level: baseLevel }
          );
        });

        return [headOuter, leftEye, rightEye, ...mouthSegmentsArray];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      nodePosition: { x: 0, y: 0 },
      maxLevel: 1,
    } satisfies MapConfig;
  })(),
  foundations: (() => {
    const center = FOUNDATIONS_CENTER;
    const size: SceneSize = { width: 1000, height: 1000 };
    const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 30 };
    const sides = 5;
    const outerRadius = 360;
    const layerThicknessTraining = getBrickConfig("smallTrainingBrick").size.width;
    const layerThicknessGray = getBrickConfig("smallSquareGray").size.width;
    const innerRadius = Math.max(outerRadius - layerThicknessTraining - layerThicknessGray, 0);
    const middleRadius = Math.max(outerRadius - layerThicknessGray, 0);

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
    const middleVertices = createPolygon(middleRadius);
    const expandedVertices = createPolygon(outerRadius + getBrickConfig("smallSquareGray").size.width * 1.5);

    return {
      name: "Cracked Pentagon",
      size,
      spawnPoints: [spawnPoint],
      unlockedBy: [
        {
          type: "map",
          id: "trainingGrounds",
          level: 1,
        },
      ],
      nodePosition: { x: 1, y: 1 },
      maxLevel: 1,
      bricks: ({ mapLevel }) => [
        polygonWithBricks(
          "smallTrainingBrick",
          {
            vertices: middleVertices,
            holes: [innerVertices],
            offsetX: center.x,
            offsetY: center.y,
          },
          { level: mapLevel }
        ),
        polygonWithBricks(
          "smallSquareGray",
          {
            vertices: outerVertices,
            holes: [middleVertices],
            offsetX: center.x,
            offsetY: center.y,
          },
          { level: mapLevel }
        ),
        ...expandedVertices.map((vertex) => circleWithBricks(
          "smallSquareGray",
          {
            center: vertex,
            innerRadius: 0,
            outerRadius: getBrickConfig("smallSquareGray").size.width * 3,
          },
          { level: mapLevel }
        ))
      ],
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      mapsRequired: { trainingGrounds: 1 },
    } satisfies MapConfig;
  })(),
  initial: {
    name: "Initial Grounds",
    size: { width: 1200, height: 1200 },
    unlockedBy: [
      {
        type: "map",
        id: "foundations",
        level: 1,
      },
    ],
    nodePosition: { x: 2, y: 2 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const innerLevel = baseLevel + 1;
      const center: SceneVector2 = { x: 600, y: 600 };
      const largeCircle = circleWithBricks(
        "smallSquareGray",
        {
          center,
          innerRadius: 210,
          outerRadius: 250,
        },
        { level: innerLevel }
      );

      const largeYellowCircle = circleWithBricks(
        "smallSquareYellow",
        {
          center,
          innerRadius: 130,
          outerRadius: 210,
        },
        { level: baseLevel }
      );

      const satelliteCount = 8;
      const satelliteRadius = 80;
      const orbitRadius = 350 + satelliteRadius;

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
    mapsRequired: { foundations: 1 },
    maxLevel: 2,
  },
  sphinx: (() => {
    const size: SceneSize = { width: 1400, height: 1200 };
    const center: SceneVector2 = { x: size.width * 0.55, y: size.height * 0.55 };
    const spawnPoint: SceneVector2 = { x: center.x - 400, y: size.height - 180 };

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

    return {
      name: "Sand Sphinx",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 2, y: 1 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const sandLevel = baseLevel + 2;

        const base = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: createRectangle(120, size.height - 260, size.width - 240, 220),
          },
          { level: sandLevel }
        );

        const body = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: createRectangle(center.x - 260, center.y - 180, 520, 220),
          },
          { level: sandLevel }
        );

        const head = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: createRectangle(center.x - 300, center.y - 320, 180, 160),
          },
          { level: sandLevel }
        );

        const paws = [
          polygonWithBricks(
            "smallSquareYellow",
            { vertices: createRectangle(center.x - 320, center.y - 30, 180, 90) },
            { level: sandLevel }
          ),
          polygonWithBricks(
            "smallSquareYellow",
            { vertices: createRectangle(center.x + 120, center.y - 30, 180, 90) },
            { level: sandLevel }
          ),
        ];

        const backCrest = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: center.x + 200, y: center.y - 60 },
            innerRadius: 0,
            outerRadius: 140,
          },
          { level: sandLevel }
        );

        const tail = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: center.x + 320, y: center.y + 40 },
            innerRadius: 0,
            outerRadius: 110,
          },
          { level: sandLevel }
        );

        return [base, body, head, ...paws, backCrest, tail];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "initial",
          level: 2,
        },
      ],
      mapsRequired: { initial: 2 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
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
      nodePosition: { x: 2, y: 3 },
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
      mapsRequired: { initial: 1 },
      maxLevel: 3,
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
      nodePosition: { x: 3, y: 2 },
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
      mapsRequired: { initial: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  spruce: (() => {
    const size: SceneSize = { width: 1500, height: 1500 };
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
    const createTriangle = (
      baseCenter: SceneVector2,
      width: number,
      height: number
    ): SceneVector2[] => [
      { x: baseCenter.x, y: baseCenter.y - height },
      { x: baseCenter.x + width / 2, y: baseCenter.y },
      { x: baseCenter.x - width / 2, y: baseCenter.y },
    ];

    const treeConfigs: readonly { base: SceneVector2; scale: number }[] = [
      { base: { x: 350, y: 1200 }, scale: 1 },
      { base: { x: 650, y: 1100 }, scale: 0.95 },
      { base: { x: 950, y: 1250 }, scale: 1.1 },
      { base: { x: 1230, y: 1150 }, scale: 0.9 },
      { base: { x: 500, y: 900 }, scale: 0.85 },
      { base: { x: 1050, y: 880 }, scale: 0.9 },
    ];

    const spawnPoint: SceneVector2 = { x: 200, y: 1300 };

    return {
      name: "Forest",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 3, y: 4 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const canopyLevel = baseLevel + 1;
        const trunkLevel = baseLevel;

        const trees = treeConfigs.flatMap((tree) => {
          const trunkHeight = 180 * tree.scale;
          const trunkWidth = 60 * tree.scale;
          const trunkBottomY = tree.base.y;
          const trunkTopY = trunkBottomY - trunkHeight;

          const trunk = polygonWithBricks(
            "smallWood",
            {
              vertices: createRectangle(
                tree.base.x - trunkWidth / 2,
                trunkTopY,
                trunkWidth,
                trunkHeight
              ),
            },
            { level: trunkLevel }
          );

          const canopyLayers = [
            { width: 320, height: 260, offset: 20 },
            { width: 260, height: 220, offset: 120 },
            { width: 190, height: 180, offset: 210 },
          ];

          const canopy = canopyLayers.map((layer) => {
            const baseCenter: SceneVector2 = {
              x: tree.base.x,
              y: trunkTopY + layer.offset * tree.scale,
            };
            return polygonWithBricks(
              "smallOrganic",
              {
                vertices: createTriangle(
                  baseCenter,
                  layer.width * tree.scale,
                  layer.height * tree.scale
                ),
              },
              { level: canopyLevel }
            );
          });

          return [trunk, ...canopy];
        });

        return trees;
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "thicket",
          level: 1,
        },
      ],
      mapsRequired: { thicket: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  stoneCottage: (() => {
    const size: SceneSize = { width: 1300, height: 1200 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const spawnPoint: SceneVector2 = { x: center.x, y: size.height - 160 };

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

    return {
      name: "Stone Cottage",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 2, y: 4 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const stoneLevel = baseLevel + 3;
        const ironLevel = baseLevel + 1;
        const organicLevel = baseLevel + 1;

        const walls = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createRectangle(center.x - 260, center.y - 220, 520, 320),
            holes: [createRectangle(center.x - 80, center.y + 40, 160, 120)],
          },
          { level: stoneLevel }
        );

        const roof = polygonWithBricks(
          "smallIron",
          {
            vertices: [
              { x: center.x - 300, y: center.y - 220 },
              { x: center.x, y: center.y - 360 },
              { x: center.x + 300, y: center.y - 220 },
            ],
          },
          { level: ironLevel }
        );

        const doorFrame = polygonWithBricks(
          "smallIron",
          {
            vertices: createRectangle(center.x - 60, center.y + 120, 120, 120),
          },
          { level: ironLevel }
        );

        const chimney = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createRectangle(center.x + 140, center.y - 340, 70, 180),
          },
          { level: stoneLevel }
        );

        const bushes = [
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x - 280, y: center.y + 200 }, innerRadius: 0, outerRadius: 90 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x + 280, y: center.y + 200 }, innerRadius: 0, outerRadius: 100 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x - 200, y: center.y + 260 }, innerRadius: 0, outerRadius: 70 },
            { level: organicLevel }
          ),
        ];

        const courtyard = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createRectangle(center.x - 140, center.y + 200, 280, 100),
          },
          { level: stoneLevel }
        );

        return [walls, roof, doorFrame, chimney, courtyard, ...bushes];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "thicket",
          level: 1,
        },
      ],
      mapsRequired: { thicket: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  mine: (() => {
    const size: SceneSize = { width: 1200, height: 1200 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const shaftRadius = 320;
    const wallThickness = 120;
    const entryWidth = 140;
    const spawnPoint: SceneVector2 = { x: center.x, y: size.height - 160 };

    const createSupport = (angle: number, length: number, width: number): SceneVector2[] => {
      const dx = Math.cos(angle) * length;
      const dy = Math.sin(angle) * length;
      const px = -Math.sin(angle) * width;
      const py = Math.cos(angle) * width;
      return [
        { x: center.x - dx + px, y: center.y - dy + py },
        { x: center.x - dx - px, y: center.y - dy - py },
        { x: center.x + dx - px, y: center.y + dy - py },
        { x: center.x + dx + px, y: center.y + dy + py },
      ];
    };

    return {
      name: "Collapsed Mine",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 4, y: 5 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const wallLevel = baseLevel + 1;

        const ironWalls = circleWithBricks(
          "smallIron",
          {
            center,
            innerRadius: shaftRadius,
            outerRadius: shaftRadius + wallThickness,
          },
          { level: wallLevel }
        );

        const coalVein = circleWithBricks(
          "smallCoal",
          {
            center,
            innerRadius: 0,
            outerRadius: shaftRadius - 40,
          },
          { level: baseLevel }
        );

        const entryTunnel = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: [
              { x: center.x - entryWidth / 2, y: spawnPoint.y },
              { x: center.x + entryWidth / 2, y: spawnPoint.y },
              { x: center.x + entryWidth / 2, y: center.y + shaftRadius - 20 },
              { x: center.x - entryWidth / 2, y: center.y + shaftRadius - 20 },
            ],
          },
          { level: wallLevel }
        );

        const supports = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) =>
          polygonWithBricks(
            "smallIron",
            {
              vertices: createSupport(angle, shaftRadius + wallThickness * 0.45, 30),
            },
            { level: wallLevel }
          )
        );

        return [ironWalls, coalVein, entryTunnel, ...supports];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "spruce",
          level: 1,
        },
      ],
      mapsRequired: { spruce: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  adit: (() => {
    const size: SceneSize = { width: 1500, height: 1200 };
    const spawnPoint: SceneVector2 = { x: 200, y: size.height - 140 };

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

    return {
      name: "Adit Corridors",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 5, y: 4 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const ironLevel = baseLevel + 1;
        const sandLevel = baseLevel + 2;
        const corridorWidth = 90;

        const horizontalRuns = [
          { x: 140, y: 260, width: size.width - 280 },
          { x: 140, y: 520, width: size.width - 360 },
          { x: 260, y: 780, width: size.width - 420 },
        ].map((run) =>
          polygonWithBricks(
            "smallIron",
            { vertices: createRectangle(run.x, run.y, run.width, corridorWidth) },
            { level: ironLevel }
          )
        );

        const verticalRuns = [
          { x: 340, y: 200, height: size.height - 360 },
          { x: 720, y: 140, height: size.height - 280 },
          { x: 1100, y: 220, height: size.height - 420 },
        ].map((run) =>
          polygonWithBricks(
            "smallIron",
            { vertices: createRectangle(run.x, run.y, corridorWidth, run.height) },
            { level: ironLevel }
          )
        );

        const chambers = [
          { x: 420, y: 320, width: 200, height: 140 },
          { x: 880, y: 360, width: 220, height: 160 },
          { x: 560, y: 680, width: 240, height: 180 },
          { x: 980, y: 660, width: 220, height: 190 },
        ].map((room) =>
          polygonWithBricks(
            "smallSquareYellow",
            { vertices: createRectangle(room.x, room.y, room.width, room.height) },
            { level: sandLevel }
          )
        );

        const barricades = [
          { x: 200, y: size.height - 230, width: size.width - 360, height: corridorWidth },
          { x: size.width - 260, y: 160, width: corridorWidth, height: size.height - 320 },
        ].map((segment) =>
          polygonWithBricks(
            "smallSquareYellow",
            { vertices: createRectangle(segment.x, segment.y, segment.width, segment.height) },
            { level: sandLevel }
          )
        );

        return [...horizontalRuns, ...verticalRuns, ...chambers, ...barricades];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "mine",
          level: 1,
        },
      ],
      mapsRequired: { mine: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  wire: (() => {
    const size: SceneSize = { width: 1500, height: 1500 };
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
    const cableCenters: readonly SceneVector2[] = [
      { x: 350, y: 350 },
      { x: 520, y: 260 },
      { x: 780, y: 420 },
      { x: 1030, y: 360 },
      { x: 1280, y: 520 },
      { x: 1120, y: 820 },
      { x: 860, y: 960 },
      { x: 620, y: 900 },
      { x: 420, y: 1080 }
    ];

    const createConnector = (
      start: SceneVector2,
      end: SceneVector2,
      halfWidth: number
    ): SceneVector2[] => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) {
        return createRectangle(start.x - halfWidth, start.y - halfWidth, halfWidth * 2, halfWidth * 2);
      }
      const ux = dx / length;
      const uy = dy / length;
      const px = -uy * halfWidth;
      const py = ux * halfWidth;
      return [
        { x: start.x + px, y: start.y + py },
        { x: start.x - px, y: start.y - py },
        { x: end.x - px, y: end.y - py },
        { x: end.x + px, y: end.y + py },
      ];
    };

    const spawnPoint: SceneVector2 = { x: 180, y: 300 };

    return {
      name: "Wire",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 4, y: 1 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const outerLevel = baseLevel + 2;
        const outerRadius = 90;
        const innerRadius = 40;

        const outerSegments = cableCenters.flatMap((center, index) => {
          const circle = circleWithBricks(
            "smallSquareGray",
            {
              center,
              innerRadius: 0,
              outerRadius,
            },
            { level: outerLevel }
          );

          if (index >= cableCenters.length - 1) {
            return [circle];
          }

          const nextCenter = cableCenters[index + 1];
          if (!nextCenter) {
            return [circle];
          }

          const connector = polygonWithBricks(
            "smallSquareGray",
            {
              vertices: createConnector(center, nextCenter, outerRadius),
            },
            { level: outerLevel }
          );

          return [circle, connector];
        });

        const innerSegments = cableCenters.flatMap((center, index) => {
          const circle = circleWithBricks(
            "smallCopper",
            {
              center,
              innerRadius: 0,
              outerRadius: innerRadius,
            },
            { level: baseLevel }
          );

          if (index >= cableCenters.length - 1) {
            return [circle];
          }

          const nextCenter = cableCenters[index + 1];
          if (!nextCenter) {
            return [circle];
          }

          const connector = polygonWithBricks(
            "smallCopper",
            {
              vertices: createConnector(center, nextCenter, innerRadius),
            },
            { level: baseLevel }
          );

          return [circle, connector];
        });

        return [...outerSegments, ...innerSegments];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "oldForge",
          level: 1,
        },
      ],
      mapsRequired: { oldForge: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  silverRing: (() => {
    const size: SceneSize = { width: 1500, height: 1500 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };
    const outerRadius = 520;
    const innerRadius = 360;
    const gemRadius = 60;

    return {
      name: "Silver Ring",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 4, y: 0 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const ringLevel = baseLevel;
        const gemLevel = baseLevel + 1;

        const silverRing = circleWithBricks(
          "smallSilver",
          {
            center,
            innerRadius,
            outerRadius,
          },
          { level: ringLevel }
        );

        const copperGem = circleWithBricks(
          "smallCopper",
          {
            center: { x: center.x + outerRadius + 50, y: center.y },
            innerRadius: 0,
            outerRadius: gemRadius*1.25,
          },
          { level: gemLevel }
        );
        const copperGem2 = circleWithBricks(
          "smallCopper",
          {
            center: { x: center.x + outerRadius-25, y: center.y + 50 },
            innerRadius: 0,
            outerRadius: gemRadius,
          },
          { level: gemLevel }
        );
        const copperGem3 = circleWithBricks(
          "smallCopper",
          {
            center: { x: center.x + outerRadius-25, y: center.y - 50 },
            innerRadius: 0,
            outerRadius: gemRadius,
          },
          { level: gemLevel }
        );

        return [silverRing, copperGem, copperGem2, copperGem3];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "wire",
          level: 1,
        },
      ],
      mapsRequired: { wire: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  frozenForest: (() => {
    const size: SceneSize = { width: 1500, height: 1500 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const spawnPoint: SceneVector2 = { x: 200, y: 200 };
    const lakeRadius = 450;

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

    const createTriangle = (
      baseCenter: SceneVector2,
      width: number,
      height: number
    ): SceneVector2[] => [
      { x: baseCenter.x, y: baseCenter.y - height },
      { x: baseCenter.x + width / 2, y: baseCenter.y },
      { x: baseCenter.x - width / 2, y: baseCenter.y },
    ];

    const treeConfigs: readonly { base: SceneVector2; scale: number }[] = [
      { base: { x: 300, y: 300 }, scale: 0.8 },
      { base: { x: 1200, y: 400 }, scale: 0.9 },
      { base: { x: 200, y: 900 }, scale: 0.85 },
      { base: { x: 1100, y: 1100 }, scale: 0.95 },
      { base: { x: 1300, y: 800 }, scale: 0.75 },
      { base: { x: 400, y: 1200 }, scale: 0.8 },
    ];

    return {
      name: "Frozen Forest",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 3, y: -1 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const iceLevel = baseLevel;
        const treeTrunkLevel = baseLevel;
        const treeCanopyLevel = baseLevel + 1;

        const frozenLake = circleWithBricks(
          "smallIce",
          {
            center,
            innerRadius: 0,
            outerRadius: lakeRadius,
          },
          { level: iceLevel }
        );

        const trees = treeConfigs.flatMap((tree) => {
          const trunkHeight = 180 * tree.scale;
          const trunkWidth = 60 * tree.scale;
          const trunkBottomY = tree.base.y;
          const trunkTopY = trunkBottomY - trunkHeight;

          const trunk = polygonWithBricks(
            "smallWood",
            {
              vertices: createRectangle(
                tree.base.x - trunkWidth / 2,
                trunkTopY,
                trunkWidth,
                trunkHeight
              ),
            },
            { level: treeTrunkLevel }
          );

          const canopyLayers = [
            { width: 320, height: 260, offset: 20 },
            { width: 260, height: 220, offset: 120 },
            { width: 190, height: 180, offset: 210 },
          ];

          const canopy = canopyLayers.map((layer) => {
            const baseCenter: SceneVector2 = {
              x: tree.base.x,
              y: trunkTopY + layer.offset * tree.scale,
            };
            return polygonWithBricks(
              "smallWood",
              {
                vertices: createTriangle(
                  baseCenter,
                  layer.width * tree.scale,
                  layer.height * tree.scale
                ),
              },
              { level: treeCanopyLevel }
            );
          });

          return [trunk, ...canopy];
        });

        return [frozenLake, ...trees];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "silverRing",
          level: 1,
        },
      ],
      mapsRequired: { silverRing: 1 },
      maxLevel: 3,
    } satisfies MapConfig;
  })(),
  volcano: (() => {
    const size: SceneSize = { width: 1500, height: 1500 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const spawnPoint: SceneVector2 = { x: 200, y: size.height - 200 };
    const volcanoBaseRadius = 400;
    const volcanoInnerRadius = 200;
    const magmaFlowRadius = 80;

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

    const magmaFlowPaths: readonly { center: SceneVector2; length: number; angle: number }[] = [
      { center: { x: center.x - 300, y: center.y + 200 }, length: 200, angle: 0.5 },
      { center: { x: center.x + 250, y: center.y + 150 }, length: 180, angle: -0.3 },
      { center: { x: center.x, y: center.y + 300 }, length: 220, angle: 0 },
      { center: { x: center.x - 200, y: center.y - 100 }, length: 150, angle: 1.2 },
      { center: { x: center.x + 300, y: center.y - 150 }, length: 170, angle: -1.0 },
    ];

    return {
      name: "Volcano",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 5, y: 5 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const copperLevel = baseLevel + 2;
        const stoneLevel = baseLevel + 4;
        const magmaLevel = baseLevel;

        const volcanoBase = circleWithBricks(
          "smallCopper",
          {
            center,
            innerRadius: volcanoInnerRadius,
            outerRadius: volcanoBaseRadius,
          },
          { level: copperLevel }
        );

        const volcanoCore = circleWithBricks(
          "smallSquareGray",
          {
            center,
            innerRadius: 0,
            outerRadius: volcanoInnerRadius - 40,
          },
          { level: stoneLevel }
        );

        const magmaFlows = magmaFlowPaths.map((flow) =>
          circleWithBricks(
            "smallMagma",
            {
              center: flow.center,
              innerRadius: 0,
              outerRadius: magmaFlowRadius,
            },
            { level: magmaLevel }
          )
        );

        return [volcanoBase, volcanoCore, ...magmaFlows];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      unlockedBy: [
        {
          type: "map",
          id: "mine",
          level: 1,
        },
      ],
      mapsRequired: { mine: 1 },
      maxLevel: 3,
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
