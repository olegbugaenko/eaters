import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { bezierPolygonWithBricks, circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 620, y: center.y };
  const ringRadius = 180;
  const ringCenterDistance = ringRadius * 2;

  const ringCenters: SceneVector2[] = Array.from({ length: 6 }, (_, index) => {
    const angle = (-Math.PI / 2) + (index * Math.PI) / 3;
    return {
      x: center.x + Math.cos(angle) * ringCenterDistance,
      y: center.y + Math.sin(angle) * ringCenterDistance,
    };
  });

  const enemiesPerRing = 3;
  const enemyPlacementRadius = ringRadius * 0.5;

  return {
    name: "Snake Nest",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 1, y: 6 },
    bricks: ({ mapLevel }) => {
      const stoneLevel = Math.max(1, Math.floor(mapLevel + 5));
      return [...ringCenters.map((ringCenter) =>
        circleWithBricks(
          "smallSquareYellow",
          {
            center: ringCenter,
            innerRadius: ringRadius - 22,
            outerRadius: ringRadius,
          },
          { level: stoneLevel },
        ),
      ),
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x - 100, y: center.y },
              control1: { x: center.x - 140, y: center.y - 200 },
              control2: { x: center.x - 220, y: center.y - 300 },
              end: { x: center.x - 360, y: center.y - 300 },
            },
            {
              start: { x: center.x - 400, y: center.y - 300 },
              control1: { x: center.x - 320, y: center.y - 300 },
              control2: { x: center.x - 240, y: center.y - 200 },
              end: { x: center.x - 140, y: center.y },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x - 100, y: center.y+100 },
              control1: { x: center.x - 140, y: center.y - 100 },
              control2: { x: center.x - 220, y: center.y - 200 },
              end: { x: center.x - 360, y: center.y - 200 },
            },
            {
              start: { x: center.x - 400, y: center.y - 200 },
              control1: { x: center.x - 320, y: center.y - 200 },
              control2: { x: center.x - 240, y: center.y - 100 },
              end: { x: center.x - 140, y: center.y + 100 },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x, y: center.y+160 },
              control1: { x: center.x, y: center.y },
              control2: { x: center.x - 40, y: center.y - 100 },
              end: { x: center.x - 100, y: center.y - 150 },
            },
            {
              start: { x: center.x - 120, y: center.y - 150 },
              control1: { x: center.x - 80 , y: center.y - 100 },
              control2: { x: center.x - 120, y: center.y },
              end: { x: center.x - 40, y: center.y + 160 },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
      // Симетричні травинки відносно осі x = center.x
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x + 100, y: center.y },
              control1: { x: center.x + 140, y: center.y - 200 },
              control2: { x: center.x + 220, y: center.y - 300 },
              end: { x: center.x + 360, y: center.y - 300 },
            },
            {
              start: { x: center.x + 400, y: center.y - 300 },
              control1: { x: center.x + 320, y: center.y - 300 },
              control2: { x: center.x + 240, y: center.y - 200 },
              end: { x: center.x + 140, y: center.y },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x + 100, y: center.y + 100 },
              control1: { x: center.x + 140, y: center.y - 100 },
              control2: { x: center.x + 220, y: center.y - 200 },
              end: { x: center.x + 360, y: center.y - 200 },
            },
            {
              start: { x: center.x + 400, y: center.y - 200 },
              control1: { x: center.x + 320, y: center.y - 200 },
              control2: { x: center.x + 240, y: center.y - 100 },
              end: { x: center.x + 140, y: center.y + 100 },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
      bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: [
            {
              start: { x: center.x, y: center.y + 160 },
              control1: { x: center.x, y: center.y },
              control2: { x: center.x + 40, y: center.y - 100 },
              end: { x: center.x + 100, y: center.y - 150 },
            },
            {
              start: { x: center.x + 120, y: center.y - 150 },
              control1: { x: center.x + 80, y: center.y - 100 },
              control2: { x: center.x + 120, y: center.y },
              end: { x: center.x + 40, y: center.y + 160 },
            }
          ],
          spacing: 22,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: mapLevel + 4 },
      ),
    ];
    },
    enemies: ({ mapLevel }) => {
      const enemyLevel = Math.max(1, Math.floor(mapLevel));
      const enemies = ringCenters.flatMap((ringCenter) =>
        Array.from({ length: enemiesPerRing }, (_, index) => {
          const angle = (index * Math.PI * 2) / enemiesPerRing;
          return {
            type: "snakeEnemy" as const,
            level: enemyLevel,
            position: {
              x: ringCenter.x + Math.cos(angle) * enemyPlacementRadius,
              y: ringCenter.y + Math.sin(angle) * enemyPlacementRadius,
            },
          };
        }),
      );
      return enemies;
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
        id: "bezierGrove",
        level: 1,
      },
    ],
    mapsRequired: { bezierGrove: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
