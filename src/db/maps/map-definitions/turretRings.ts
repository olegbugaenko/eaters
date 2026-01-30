import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  BrickShapeBlueprint,
  circleWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
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
          { level },
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
})();

export default mapConfig;
