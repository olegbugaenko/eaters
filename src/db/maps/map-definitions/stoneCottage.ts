import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1300, height: 1400 };
  const center: SceneVector2 = { x: size.width / 2, y: (size.height - 200) / 2 };
  const spawnPoint: SceneVector2 = { x: center.x, y: size.height - 360 };

  const createRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
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
        enemyTypes: [{ type: "spectreEnemy", weight: 1.0 }],
        maxConcurrent: 5,
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
          holes: [createRectangle(center.x - 80, center.y - 150, 120, 160)],
        },
        { level: stoneLevel },
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
        { level: ironLevel },
      );

      const doorFrame = polygonWithBricks(
        "smallIron",
        {
          vertices: createRectangle(center.x - 60, center.y + 120, 120, 120),
        },
        { level: ironLevel },
      );

      const chimney = polygonWithBricks(
        "smallSquareGray",
        {
          vertices: createRectangle(center.x + 140, center.y - 340, 70, 180),
        },
        { level: stoneLevel },
      );

      const bushes = [
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x - 280, y: center.y + 200 },
            innerRadius: 0,
            outerRadius: 90,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x + 280, y: center.y + 200 },
            innerRadius: 0,
            outerRadius: 100,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x + 320, y: center.y + 20 },
            innerRadius: 0,
            outerRadius: 100,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x + 400, y: center.y - 90 },
            innerRadius: 0,
            outerRadius: 100,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x + 390, y: center.y + 140 },
            innerRadius: 0,
            outerRadius: 100,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x - 200, y: center.y + 260 },
            innerRadius: 0,
            outerRadius: 70,
          },
          { level: organicLevel },
        ),
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: center.x - 130, y: center.y + 200 },
            innerRadius: 0,
            outerRadius: 70,
          },
          { level: organicLevel },
        ),
      ];

      const courtyard = polygonWithBricks(
        "smallSquareGray",
        {
          vertices: createRectangle(center.x - 140, center.y + 200, 280, 100),
        },
        { level: stoneLevel - 1 },
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
})();

export default mapConfig;
