import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { squareWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: 600, y: 600 };
  const spawnPoint: SceneVector2 = { x: 600, y: 100 };

  const satelliteCount = 4;
  const satelliteRadius = 80;
  const orbitRadius = 350 + satelliteRadius;

  const satellites = Array.from({ length: satelliteCount }, (_, index) => {
    const angle = (index / satelliteCount) * Math.PI * 2 + Math.PI / 4;
    const position: SceneVector2 = {
      x: center.x + Math.cos(angle) * orbitRadius,
      y: center.y + Math.sin(angle) * orbitRadius,
    };
    return position;
  });

  return {
    name: "Encaged Beast",
    size,
    icon: "encaged_beast.png",
    achievementId: "encaged_beast",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "deathfulGuns",
        level: 1,
      },
    ],
    nodePosition: { x: -3, y: 2 },
    maxLevel: 5,
    bricks: ({ mapLevel }) => {
      const copperSquares = satellites.map((position) => {
        const squareSize = satelliteRadius * 2;
        return squareWithBricks(
          "smallCopper",
          {
            center: position,
            size: squareSize,
            innerSize: satelliteRadius,
          },
          { level: mapLevel + 1 },
        );
      });

      const centerSquare = squareWithBricks(
        "smallWood",
        {
          center: center,
          size: (orbitRadius - satelliteRadius) * 1.3,
          innerSize: (orbitRadius - satelliteRadius) * 0.9,
        },
        { level: mapLevel + 1 },
      );

      return [...copperSquares, centerSquare];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return [
        ...satellites.map((position) => {
          return {
            type: "explosionTurretEnemy",
            level,
            position,
          } satisfies EnemySpawnData;
        }),
        {
          type: "encagedBeastEnemy",
          level,
          position: center,
        } satisfies EnemySpawnData,
      ];
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
