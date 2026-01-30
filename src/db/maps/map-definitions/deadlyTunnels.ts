import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  connectorWithBricks,
  squareWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: 600, y: 600 };
  const spawnPoint: SceneVector2 = { x: 600, y: 600 };

  const satelliteCount = 8;
  const satelliteRadius = 80;
  const orbitRadius = 350 + satelliteRadius;

  const satellites = Array.from({ length: satelliteCount }, (_, index) => {
    const angle = (index / satelliteCount) * Math.PI * 2;
    const position: SceneVector2 = {
      x: center.x + Math.cos(angle) * orbitRadius,
      y: center.y + Math.sin(angle) * orbitRadius,
    };
    return position;
  });

  return {
    name: "Deadly Tunnels",
    size,
    icon: "deadly_tunnels.png",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "deathfulGuns",
        level: 1,
      },
    ],
    nodePosition: { x: -4, y: 0 },
    maxLevel: 10,
    bricks: ({ mapLevel }) => {
      const stoneLevel = mapLevel + 3;

      // Створюємо квадрати з міді
      const copperSquares = satellites.map((position) => {
        const squareSize = satelliteRadius * 2;
        return squareWithBricks(
          "smallCopper",
          {
            center: position,
            size: squareSize,
            innerSize: satelliteRadius * 0.9,
          },
          { level: mapLevel },
        );
      });

      // Створюємо з'єднання з каменю між супутниками
      const stoneConnectors = satellites.flatMap((position, index) => {
        const nextIndex = (index + 1) % satelliteCount;
        const nextPosition = satellites[nextIndex];
        if (!nextPosition) {
          return [];
        }

        // Обчислюємо точки на зовнішніх краях квадратів для з'єднання
        const squareSize = satelliteRadius * 2;
        const halfSize = squareSize / 2;

        // Напрямок від першого квадрата до другого
        const dx = nextPosition.x - position.x;
        const dy = nextPosition.y - position.y;
        const length = Math.hypot(dx, dy);

        if (length === 0) {
          return [];
        }

        // Нормалізуємо вектор напрямку
        const ux = dx / length;
        const uy = dy / length;

        // Для квадрата без обертання: знаходимо точку на грані
        // Використовуємо максимальну координату для визначення грані
        const absUx = Math.abs(ux);
        const absUy = Math.abs(uy);
        const maxAbs = Math.max(absUx, absUy);

        // Масштабуємо для досягнення грані квадрата
        const scale1 = halfSize / maxAbs;
        const edgePoint1: SceneVector2 = {
          x: position.x + ux * scale1,
          y: position.y + uy * scale1,
        };

        // Аналогічно для другого квадрата (в зворотному напрямку)
        const scale2 = halfSize / maxAbs;
        const edgePoint2: SceneVector2 = {
          x: nextPosition.x - ux * scale2,
          y: nextPosition.y - uy * scale2,
        };

        const connectorWidth = satelliteRadius * 0.8;
        return connectorWithBricks(
          "smallSquareGray",
          {
            start: edgePoint1,
            end: edgePoint2,
            width: connectorWidth,
          },
          { level: stoneLevel },
        );
      });

      return [...copperSquares, ...stoneConnectors];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return satellites.map((position) => {
        return {
          type: "volleyTurretEnemy",
          level,
          position,
        } satisfies EnemySpawnData;
      });
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    mapsRequired: { deathfulGuns: 1 },
  } satisfies MapConfig;
})();

export default mapConfig;
