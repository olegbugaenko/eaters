import { BrickType, getBrickConfig } from "./bricks-db";
import { SceneSize, SceneVector2 } from "../logic/services/scene-object-manager/scene-object-manager.types";
import { PlayerUnitType } from "./player-units-db";
import type { EnemyType } from "./enemies-db";
import type { EnemySpawnData } from "../logic/modules/active-map/enemies/enemies.types";
import type { UnlockCondition } from "@shared/types/unlocks";
import type { SkillId } from "./skills-db";
import type { AchievementId } from "./achievements-db";
import {
  BrickShapeBlueprint,
  buildBricksFromBlueprints,
  circleWithBricks,
  polygonWithBricks,
  templateWithBricks,
} from "../logic/services/brick-layout/BrickLayoutService";

export type MapId =
  | "tutorialZone"
  | "trainingGrounds"
  | "foundations"
  | "initial"
  | "turretRings"
  | "thicket"
  | "oldForge"
  | "spruce"
  | "deadOak"
  | "sphinx"
  | "stoneCottage"
  | "wire"
  | "mine"
  | "adit"
  | "silverRing"
  | "frozenForest"
  | "volcano"
  | "megaBrick";

export interface MapBrickGeneratorOptions {
  readonly mapLevel: number;
}

export type MapBrickGenerator = (
  options: MapBrickGeneratorOptions
) => readonly BrickShapeBlueprint[];

export interface MapEnemyGeneratorOptions {
  readonly mapLevel: number;
}

export type MapEnemyGenerator = (
  options: MapEnemyGeneratorOptions
) => readonly EnemySpawnData[];

export interface MapNodePosition {
  readonly x: number;
  readonly y: number;
}

export interface MapEnemySpawnTypeConfig {
  readonly type: EnemyType;
  readonly weight: number; // Вага для випадкового вибору (1.0 = базовий, 2.0 = вдвічі частіше)
  readonly minLevel?: number; // Мінімальний рівень карти для появи
  readonly maxLevel?: number; // Максимальний рівень карти
}

export interface MapEnemySpawnPointConfig {
  readonly position: SceneVector2;
  readonly spawnRate: number; // Ворогів на секунду (або інтервал між спавнами)
  readonly enemyTypes: readonly MapEnemySpawnTypeConfig[];
  readonly maxConcurrent?: number; // Максимальна кількість одночасно активних ворогів
  readonly enabled?: boolean; // Можна вимкнути для певних рівнів
  readonly levelOffset?: number; // Зміщення рівня ворогів відносно рівня карти (за замовчуванням 0)
}

export interface MapConfig {
  readonly name: string;
  readonly size: SceneSize;
  readonly bricks: MapBrickGenerator;
  readonly playerUnits?: readonly MapPlayerUnitConfig[];
  readonly spawnPoints?: readonly SceneVector2[];
  readonly enemySpawnPoints?: readonly MapEnemySpawnPointConfig[];
  readonly enemies?: MapEnemyGenerator; // Статичні вороги (турелі), що генеруються один раз при ініціалізації
  readonly unlockedBy?: readonly UnlockCondition<MapId, SkillId>[];
  readonly icon?: string;
  readonly nodePosition: MapNodePosition;
  readonly mapsRequired?: Partial<Record<MapId, number>>;
  readonly maxLevel: number;
  readonly resourceMultiplier?: number; // Множник ресурсів для цієї мапи (застосовується до brick_rewards)
  readonly achievementId?: AchievementId;
}

export interface MapListEntry {
  readonly id: MapId;
  readonly name: string;
  readonly size: SceneSize;
  readonly icon?: string;
}

export interface MapPlayerUnitConfig {
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
}

const FOUNDATIONS_CENTER: SceneVector2 = { x: 500, y: 500 };

const MAPS_DB: Record<MapId, MapConfig> = {
  tutorialZone: (() => {
    const center: SceneVector2 = { x: 500, y: 600 };
    const size: SceneSize = { width: 1000, height: 1000 };
    const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 500 };

    // Простий шаблон цифри "1"
    const numberOneTemplate: readonly string[] = [
      " #####      ##      #####",
      " #         #  #       #",
      " ####     ######      #",
      " #        #    #      #",
      " #####   #      #     #",
    ];

    return {
      name: "Weird Bricks",
      size,
      spawnPoints: [spawnPoint],
      icon: "eat.png",
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));

        const numberOne = templateWithBricks(
          "smallTrainingBrick",
          {
            center,
            template: numberOneTemplate,
            horizontalGap: 1,
            verticalGap: 1,
          },
          { level: baseLevel }
        );

        return [numberOne];
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      nodePosition: { x: -1, y: -1 },
      maxLevel: 1,
    } satisfies MapConfig;
  })(),
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
      name: "Optimistic Smile",
      size,
      spawnPoints: [spawnPoint],
      icon: "training.png",
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
      mapsRequired: { tutorialZone: 1 },
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
      icon: "pentagon.png",
      spawnPoints: [spawnPoint],
      unlockedBy: [
        {
          type: "map",
          id: "trainingGrounds",
          level: 1,
        },
      ],
      nodePosition: { x: 1, y: 1 },
      mapsRequired: { trainingGrounds: 1 },
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
    } satisfies MapConfig;
  })(),
  megaBrick: (() => {
    const center = FOUNDATIONS_CENTER;
    const size: SceneSize = { width: 1000, height: 1000 };
    const spawnPoint: SceneVector2 = { x: 100, y: center.y - 30 };

    // Один цегла по центру
    const singleBrickTemplate: readonly string[] = [" # "];

    return {
      name: "Mega Brick",
      size,
      icon: "mega_brick.png",
      spawnPoints: [spawnPoint],
      unlockedBy: [
        {
          type: "map",
          id: "trainingGrounds",
          level: 1,
        },
      ],
      nodePosition: { x: -1, y: 1 },
      maxLevel: 10,
      achievementId: "megaBrick",
      bricks: ({ mapLevel }) => [
        templateWithBricks(
          "megaBrick",
          {
            center,
            template: singleBrickTemplate,
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
      mapsRequired: { trainingGrounds: 1 },
    } satisfies MapConfig;
  })(),
  initial: {
    name: "Initial Grounds",
    size: { width: 1200, height: 1200 },
    icon: "initial.png",
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
  turretRings: (() => {
    const size: SceneSize = { width: 1400, height: 1400 };
    const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
    const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 600 };

    // Позиції центрів окремих кіл (5-6 кіл)
    const ringCenters: SceneVector2[] = [
      { x: center.x - 300, y: center.y - 200 },
      { x: center.x + 300, y: center.y - 200 },
      { x: center.x - 300, y: center.y + 200 },
      { x: center.x + 300, y: center.y + 200 },
      { x: center.x, y: center.y - 400 },
      { x: center.x, y: center.y + 400 },
    ];

    return {
      name: "Turret Rings",
      size,
      icon: "ring_turrets.png",
      unlockedBy: [
        {
          type: "map",
          id: "initial",
          level: 1,
        },
      ],
      nodePosition: { x: 1, y: 2 },
      maxLevel: 1,
      spawnPoints: [spawnPoint],
      bricks: ({ mapLevel }) => {
        const level = Math.max(1, Math.floor(mapLevel));
        const ringRadius = 150;
        const brickSize = 24; // Розмір бріка smallSquareYellow
        const ringThickness = 2 * brickSize; // Товщина 2 бріки = 48px
        const innerRadius = ringRadius - ringThickness;
        const outerRadius = ringRadius;

        const rings: BrickShapeBlueprint[] = [];

        // Генеруємо окремі кола піску (використовуємо smallSquareYellow, який дає sand)
        ringCenters.forEach((ringCenter) => {
          const ring = circleWithBricks(
            "smallSquareYellow",
            {
              center: ringCenter,
              innerRadius,
              outerRadius,
            },
            { level }
          );
          rings.push(ring);
        });

        return rings;
      },
      enemies: ({ mapLevel }) => {
        const level = Math.max(1, Math.floor(mapLevel));
        const turrets: EnemySpawnData[] = [];

        // Додаємо турель в центрі кожного кола
        ringCenters.forEach((ringCenter) => {
          turrets.push({
            type: "turretEnemy",
            level,
            position: { ...ringCenter },
          });
        });

        return turrets;
      },
      playerUnits: [
        {
          type: "bluePentagon",
          position: { ...spawnPoint },
        },
      ],
      mapsRequired: { initial: 1 },
      resourceMultiplier: 2, // x2 бонус до ресурсів
    } satisfies MapConfig;
  })(),
  sphinx: (() => {
    const size: SceneSize = { width: 1400, height: 900 };
    // Sphinx lying down, facing left
    // Body center point
    const bodyX = 700;
    const bodyY = 550;
    // Spawn point far from sphinx (top right corner)
    const spawnPoint: SceneVector2 = { x: size.width - 150, y: 150 };

    return {
      name: "Sand Sphinx",
      size,
      icon: "sphynx.png",
      spawnPoints: [spawnPoint],
      nodePosition: { x: 2, y: 1 },
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const sandLevel = baseLevel + 2;

        // === BODY (lying lion, with curved back) ===
        // Main body - wider polygon with curved appearance
        const bodyMain = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 280, y: bodyY - 80 },   // front top
              { x: bodyX - 100, y: bodyY - 100 },  // mid-front top (curved up)
              { x: bodyX + 100, y: bodyY - 110 },  // mid-back top (highest point)
              { x: bodyX + 280, y: bodyY - 80 },   // back top
              { x: bodyX + 300, y: bodyY + 50 },   // back bottom
              { x: bodyX - 280, y: bodyY + 50 },   // front bottom
            ],
          },
          { level: sandLevel }
        );

        // Belly (adds roundness underneath)
        const belly = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX, y: bodyY + 20 },
            innerRadius: 0,
            outerRadius: 80,
          },
          { level: sandLevel }
        );

        // Haunches (back raised part - larger for folded hind legs)
        const haunches = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 180, y: bodyY - 50 },
            innerRadius: 0,
            outerRadius: 110,
          },
          { level: sandLevel }
        );

        // Back curve (adds more volume to the back)
        const backCurve = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 50, y: bodyY - 80 },
            innerRadius: 0,
            outerRadius: 70,
          },
          { level: sandLevel }
        );

        // === CHEST (raised front part) ===
        const chest = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 340, y: bodyY - 140 },
              { x: bodyX - 240, y: bodyY - 140 },
              { x: bodyX - 220, y: bodyY - 40 },
              { x: bodyX - 340, y: bodyY - 40 },
            ],
          },
          { level: sandLevel }
        );

        // === NECK (shorter, connects to head) ===
        const neck = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 380, y: bodyY - 200 },
              { x: bodyX - 300, y: bodyY - 200 },
              { x: bodyX - 260, y: bodyY - 130 },
              { x: bodyX - 360, y: bodyY - 130 },
            ],
          },
          { level: sandLevel }
        );

        // === HEAD (human profile facing left) ===
        // Back of head (rounded)
        const headBack = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX - 360, y: bodyY - 260 },
            innerRadius: 0,
            outerRadius: 70,
          },
          { level: sandLevel }
        );

        // Face (polygon for profile - forehead, nose, chin)
        const face = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 430, y: bodyY - 320 }, // forehead
              { x: bodyX - 480, y: bodyY - 280 }, // nose tip
              { x: bodyX - 470, y: bodyY - 250 }, // under nose
              { x: bodyX - 480, y: bodyY - 220 }, // lips
              { x: bodyX - 450, y: bodyY - 190 }, // chin
              { x: bodyX - 400, y: bodyY - 200 }, // jaw
              { x: bodyX - 380, y: bodyY - 260 }, // cheek
              { x: bodyX - 400, y: bodyY - 310 }, // temple
            ],
          },
          { level: sandLevel }
        );

        // Nemes headdress (flows down sides)
        const nemesBack = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 320, y: bodyY - 300 },
              { x: bodyX - 280, y: bodyY - 300 },
              { x: bodyX - 260, y: bodyY - 180 },
              { x: bodyX - 300, y: bodyY - 180 },
            ],
          },
          { level: sandLevel }
        );

        // Crown/top of headdress
        const crown = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 420, y: bodyY - 360 },
              { x: bodyX - 340, y: bodyY - 360 },
              { x: bodyX - 320, y: bodyY - 320 },
              { x: bodyX - 430, y: bodyY - 320 },
            ],
          },
          { level: sandLevel }
        );

        // === FRONT PAWS (extended forward, connected to body) ===
        // Left front paw (closer, starts from chest)
        const frontPawLeft = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 450, y: bodyY },
              { x: bodyX - 300, y: bodyY },
              { x: bodyX - 300, y: bodyY + 50 },
              { x: bodyX - 450, y: bodyY + 50 },
            ],
          },
          { level: sandLevel }
        );

        // Right front paw (slightly behind and lower)
        const frontPawRight = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX - 400, y: bodyY + 40 },
              { x: bodyX - 250, y: bodyY + 40 },
              { x: bodyX - 250, y: bodyY + 90 },
              { x: bodyX - 400, y: bodyY + 90 },
            ],
          },
          { level: sandLevel }
        );

        // Paw ends (toes)
        const pawEndLeft = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX - 450, y: bodyY + 25 },
            innerRadius: 0,
            outerRadius: 30,
          },
          { level: sandLevel }
        );

        const pawEndRight = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX - 400, y: bodyY + 65 },
            innerRadius: 0,
            outerRadius: 28,
          },
          { level: sandLevel }
        );

        // === HIND LEG (left, visible from side - extended like front paws) ===
        // Upper thigh (connects to haunches)
        const hindThighLeft = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX + 80, y: bodyY - 20 },
              { x: bodyX + 160, y: bodyY - 20 },
              { x: bodyX + 180, y: bodyY + 40 },
              { x: bodyX + 100, y: bodyY + 40 },
            ],
          },
          { level: sandLevel }
        );

        // Lower leg (extends forward like front paws)
        const hindLegLeft = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: bodyX + 60, y: bodyY + 30 },
              { x: bodyX + 180, y: bodyY + 30 },
              { x: bodyX + 180, y: bodyY + 80 },
              { x: bodyX + 60, y: bodyY + 80 },
            ],
          },
          { level: sandLevel }
        );

        // Hind paw (like front paws)
        const hindPawLeft = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 60, y: bodyY + 55 },
            innerRadius: 0,
            outerRadius: 32,
          },
          { level: sandLevel }
        );

        // === TAIL (more horizontal, along the ground) ===
        const tail1 = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 330, y: bodyY + 30 },
            innerRadius: 0,
            outerRadius: 35,
          },
          { level: sandLevel }
        );

        const tail2 = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 380, y: bodyY + 20 },
            innerRadius: 0,
            outerRadius: 30,
          },
          { level: sandLevel }
        );

        const tail3 = circleWithBricks(
          "smallSquareYellow",
          {
            center: { x: bodyX + 420, y: bodyY + 15 },
            innerRadius: 0,
            outerRadius: 25,
          },
          { level: sandLevel }
        );

        // === SAND BASE ===
        const sandBase = polygonWithBricks(
          "smallSquareYellow",
          {
            vertices: [
              { x: 150, y: bodyY + 120 },
              { x: size.width - 150, y: bodyY + 120 },
              { x: size.width - 130, y: bodyY + 160 },
              { x: 130, y: bodyY + 160 },
            ],
          },
          { level: sandLevel }
        );

        return [
          sandBase,
          bodyMain,
          belly,
          backCurve,
          haunches,
          chest,
          neck,
          headBack,
          face,
          nemesBack,
          crown,
          frontPawLeft,
          frontPawRight,
          pawEndLeft,
          pawEndRight,
          hindThighLeft,
          hindLegLeft,
          hindPawLeft,
          tail1,
          tail2,
          tail3,
        ];
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
      maxLevel: 1,
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
      icon: "thicket.png",
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
      maxLevel: 1,
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

    const enemySpawnPosition: SceneVector2 = { x: center.x, y: center.y + outerSize / 2 + 20 };

    return {
      name: "Old Forge",
      size,
      icon: "forge.png",
      spawnPoints: [{ x: center.x, y: center.y - outerSize / 2 + 80 }],
      /*enemySpawnPoints: [
        {
          position: enemySpawnPosition,
          spawnRate: 0.2, // 1 ворог на 5 секунд (1/5 = 0.2)
          enemyTypes: [
            { type: "tankEnemy", weight: 1.0 },
            { type: "fastEnemy", weight: 1.0 },
          ],
          maxConcurrent: 10,
        },
      ],*/
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
      maxLevel: 1,
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
      icon: "spruce.png",
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
      maxLevel: 1,
    } satisfies MapConfig;
  })(),
  deadOak: (() => {
    const size: SceneSize = { width: 1200, height: 1000 };
    const centerX = size.width / 2;
    const groundY = size.height - 150;
    const spawnPoint: SceneVector2 = { x: 200, y: 200 };

    return {
      name: "Dead Oak",
      size,
      spawnPoints: [spawnPoint],
      nodePosition: { x: 3, y: 5 },
      icon: "dead_oak.png",
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const woodLevel = baseLevel + 1;

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

        // Main trunk (thick, slightly tapered)
        const trunkWidth = 100;
        const trunkHeight = 400;
        const trunkX = centerX - trunkWidth / 2;
        const trunkY = groundY - trunkHeight;

        const trunk = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: trunkX + 10, y: trunkY },
              { x: trunkX + trunkWidth - 10, y: trunkY },
              { x: trunkX + trunkWidth, y: groundY },
              { x: trunkX, y: groundY },
            ],
          },
          { level: woodLevel }
        );

        // Main branches extending from trunk
        // Left main branch (going up-left)
        const leftMainBranch = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX - 30, y: trunkY + 80 },
              { x: centerX - 20, y: trunkY + 50 },
              { x: centerX - 200, y: trunkY - 120 },
              { x: centerX - 220, y: trunkY - 100 },
            ],
          },
          { level: woodLevel }
        );

        // Right main branch (going up-right)
        const rightMainBranch = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX + 20, y: trunkY + 50 },
              { x: centerX + 30, y: trunkY + 80 },
              { x: centerX + 220, y: trunkY - 100 },
              { x: centerX + 200, y: trunkY - 120 },
            ],
          },
          { level: woodLevel }
        );

        // Center top branch (going straight up)
        const topBranch = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX - 25, y: trunkY },
              { x: centerX + 25, y: trunkY },
              { x: centerX + 15, y: trunkY - 180 },
              { x: centerX - 15, y: trunkY - 180 },
            ],
          },
          { level: woodLevel }
        );

        // Smaller sub-branches
        // Left sub-branch 1
        const leftSubBranch1 = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX - 160, y: trunkY - 80 },
              { x: centerX - 140, y: trunkY - 90 },
              { x: centerX - 280, y: trunkY - 200 },
              { x: centerX - 300, y: trunkY - 180 },
            ],
          },
          { level: woodLevel }
        );

        // Left sub-branch 2 (lower)
        const leftSubBranch2 = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX - 80, y: trunkY + 120 },
              { x: centerX - 60, y: trunkY + 100 },
              { x: centerX - 180, y: trunkY + 20 },
              { x: centerX - 200, y: trunkY + 40 },
            ],
          },
          { level: woodLevel }
        );

        // Right sub-branch 1
        const rightSubBranch1 = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX + 140, y: trunkY - 90 },
              { x: centerX + 160, y: trunkY - 80 },
              { x: centerX + 300, y: trunkY - 180 },
              { x: centerX + 280, y: trunkY - 200 },
            ],
          },
          { level: woodLevel }
        );

        // Right sub-branch 2 (lower)
        const rightSubBranch2 = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX + 60, y: trunkY + 100 },
              { x: centerX + 80, y: trunkY + 120 },
              { x: centerX + 200, y: trunkY + 40 },
              { x: centerX + 180, y: trunkY + 20 },
            ],
          },
          { level: woodLevel }
        );

        // Top sub-branches (smaller twigs)
        const topLeftTwig = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX - 10, y: trunkY - 140 },
              { x: centerX, y: trunkY - 150 },
              { x: centerX - 80, y: trunkY - 250 },
              { x: centerX - 100, y: trunkY - 240 },
            ],
          },
          { level: woodLevel }
        );

        const topRightTwig = polygonWithBricks(
          "smallWood",
          {
            vertices: [
              { x: centerX, y: trunkY - 150 },
              { x: centerX + 10, y: trunkY - 140 },
              { x: centerX + 100, y: trunkY - 240 },
              { x: centerX + 80, y: trunkY - 250 },
            ],
          },
          { level: woodLevel }
        );

        // Ground/roots
        const roots = polygonWithBricks(
          "smallWood",
          {
            vertices: createRectangle(centerX - 150, groundY, 300, 40),
          },
          { level: woodLevel }
        );

        return [
          trunk,
          leftMainBranch,
          rightMainBranch,
          topBranch,
          leftSubBranch1,
          leftSubBranch2,
          rightSubBranch1,
          rightSubBranch2,
          topLeftTwig,
          topRightTwig,
          roots,
        ];
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
      maxLevel: 2,
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

    const enemySpawnPosition: SceneVector2 = { x: size.width - 200, y: 200 };

    return {
      name: "Stone Cottage",
      size,
      spawnPoints: [spawnPoint],
      enemySpawnPoints: [
        {
          position: enemySpawnPosition,
          spawnRate: 0.2, // 1 ворог на 5 секунд (1/5 = 0.2)
          enemyTypes: [
            { type: "spectreEnemy", weight: 1.0 },
          ],
          maxConcurrent: 10,
        },
      ],
      nodePosition: { x: 1, y: 4 },
      icon: "cottage.png",
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const stoneLevel = baseLevel + 3;
        const ironLevel = baseLevel + 1;
        const organicLevel = baseLevel + 1;

        const walls = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createRectangle(center.x - 260, center.y - 220, 520, 320),
            holes: [
              createRectangle(center.x - 80, center.y - 150, 120, 160)
            ],
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
            { center: { x: center.x + 320, y: center.y + 20 }, innerRadius: 0, outerRadius: 100 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x + 400, y: center.y - 90 }, innerRadius: 0, outerRadius: 100 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x + 390, y: center.y + 140 }, innerRadius: 0, outerRadius: 100 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x - 200, y: center.y + 260 }, innerRadius: 0, outerRadius: 70 },
            { level: organicLevel }
          ),
          circleWithBricks(
            "smallOrganic",
            { center: { x: center.x - 130, y: center.y + 200 }, innerRadius: 0, outerRadius: 70 },
            { level: organicLevel }
          ),
        ];

        const courtyard = polygonWithBricks(
          "smallSquareGray",
          {
            vertices: createRectangle(center.x - 140, center.y + 200, 280, 100),
          },
          { level: stoneLevel - 1 }
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
      maxLevel: 2,
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
      icon: "mine.png",
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
      maxLevel: 1,
    } satisfies MapConfig;
  })(),
  adit: (() => {
    const size: SceneSize = { width: 1500, height: 1200 };
    const centerX = size.width / 2;
    const centerY = size.height / 2;
    // Spawn point in center of central room (400x400)
    const spawnPoint: SceneVector2 = { x: centerX, y: centerY };

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
      nodePosition: { x: 4, y: 3 },
      icon: "adit.png",
      bricks: ({ mapLevel }) => {
        const baseLevel = Math.max(0, Math.floor(mapLevel));
        const ironLevel = baseLevel;
        const wallThickness = 40;
        const corridorWidth = 250; // 200-300px as requested

        // === CENTRAL ROOM (400x400) ===
        const centralRoomSize = 400;
        const centralRoomX = centerX - centralRoomSize / 2;
        const centralRoomY = centerY - centralRoomSize / 2;

        // === MAZE WALLS (iron) ===
        const walls: ReturnType<typeof polygonWithBricks>[] = [];

        // Outer border walls
        walls.push(
          // Top wall
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(100, 100, size.width - 200, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom wall
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(100, size.height - 100 - wallThickness, size.width - 200, wallThickness),
            },
            { level: ironLevel }
          ),
          // Left wall
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(100, 100, wallThickness, size.height - 200),
            },
            { level: ironLevel }
          ),
          // Right wall
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(size.width - 100 - wallThickness, 100, wallThickness, size.height - 200),
            },
            { level: ironLevel }
          )
        );

        // Central room walls (surrounding the 400x400 room)
        walls.push(
          // Top wall of central room
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centralRoomX - wallThickness, centralRoomY - wallThickness, centralRoomSize + wallThickness * 2, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom wall of central room
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centralRoomX - wallThickness, centralRoomY + centralRoomSize, centralRoomSize + wallThickness * 2, wallThickness),
            },
            { level: ironLevel }
          ),
          // Left wall of central room
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centralRoomX - wallThickness, centralRoomY, wallThickness, centralRoomSize),
            },
            { level: ironLevel }
          ),
          // Right wall of central room
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centralRoomX + centralRoomSize, centralRoomY, wallThickness, centralRoomSize),
            },
            { level: ironLevel }
          )
        );

        // Maze corridors - create walls around corridors (corridors are open spaces)
        // Top corridor walls (vertical walls on sides of corridor)
        const topCorridorY = 100 + wallThickness;
        const topCorridorHeight = centralRoomY - topCorridorY;
        walls.push(
          // Left wall of top corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centerX - corridorWidth / 2 - wallThickness, topCorridorY, wallThickness, topCorridorHeight),
            },
            { level: ironLevel }
          ),
          // Right wall of top corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centerX + corridorWidth / 2, topCorridorY, wallThickness, topCorridorHeight),
            },
            { level: ironLevel }
          )
        );

        // Bottom corridor walls
        const bottomCorridorY = centralRoomY + centralRoomSize + wallThickness;
        const bottomCorridorHeight = size.height - 100 - wallThickness - bottomCorridorY;
        walls.push(
          // Left wall of bottom corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centerX - corridorWidth / 2 - wallThickness, bottomCorridorY, wallThickness, bottomCorridorHeight),
            },
            { level: ironLevel }
          ),
          // Right wall of bottom corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(centerX + corridorWidth / 2, bottomCorridorY, wallThickness, bottomCorridorHeight),
            },
            { level: ironLevel }
          )
        );

        // Left corridor walls (horizontal walls on top/bottom of corridor)
        const leftCorridorX = 100 + wallThickness;
        const leftCorridorWidth = centralRoomX - leftCorridorX;
        walls.push(
          // Top wall of left corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(leftCorridorX, centerY - corridorWidth / 2 - wallThickness, leftCorridorWidth, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom wall of left corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(leftCorridorX, centerY + corridorWidth / 2, leftCorridorWidth, wallThickness),
            },
            { level: ironLevel }
          )
        );

        // Right corridor walls
        const rightCorridorX = centralRoomX + centralRoomSize + wallThickness;
        const rightCorridorWidth = size.width - 100 - wallThickness - rightCorridorX;
        walls.push(
          // Top wall of right corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(rightCorridorX, centerY - corridorWidth / 2 - wallThickness, rightCorridorWidth, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom wall of right corridor
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(rightCorridorX, centerY + corridorWidth / 2, rightCorridorWidth, wallThickness),
            },
            { level: ironLevel }
          )
        );

        // Additional maze walls (creating dead ends and paths)
        // Horizontal dividers in corners
        walls.push(
          // Top-left corner divider
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(200, 300, 300, wallThickness),
            },
            { level: ironLevel }
          ),
          // Top-right corner divider
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(1000, 300, 300, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom-left corner divider
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(200, size.height - 100 - wallThickness - 300, 300, wallThickness),
            },
            { level: ironLevel }
          ),
          // Bottom-right corner divider
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(1000, size.height - 100 - wallThickness - 300, 300, wallThickness),
            },
            { level: ironLevel }
          )
        );

        // Vertical dividers in corners
        walls.push(
          // Top-left vertical
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(400, 100 + wallThickness, wallThickness, 200),
            },
            { level: ironLevel }
          ),
          // Top-right vertical
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(1100, 100 + wallThickness, wallThickness, 200),
            },
            { level: ironLevel }
          ),
          // Bottom-left vertical
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(400, size.height - 100 - wallThickness - 200, wallThickness, 200),
            },
            { level: ironLevel }
          ),
          // Bottom-right vertical
          polygonWithBricks(
            "compactIron",
            {
              vertices: createRectangle(1100, size.height - 100 - wallThickness - 200, wallThickness, 200),
            },
            { level: ironLevel }
          )
        );

        return walls;
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
      maxLevel: 2,
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
      icon: "wire.png",
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
      maxLevel: 1,
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
      icon: "silver_ring.png",
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
      maxLevel: 1,
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
      icon: "frozen_forest.png",
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
      maxLevel: 1,
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
      icon: "volcano.png",
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
      maxLevel: 1,
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
    return {
      id: mapId,
      name: config.name,
      size: { ...config.size },
      icon: config.icon,
    };
  });
