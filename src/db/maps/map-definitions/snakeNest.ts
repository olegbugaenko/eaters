import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 620, y: center.y };
  const ringRadius = 120;
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
      const stoneLevel = Math.max(1, Math.floor(mapLevel + 8));
      return ringCenters.map((ringCenter) =>
        circleWithBricks(
          "smallSquareGray",
          {
            center: ringCenter,
            innerRadius: ringRadius - 22,
            outerRadius: ringRadius,
          },
          { level: stoneLevel },
        ),
      );
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
