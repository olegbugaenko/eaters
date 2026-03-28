import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
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
    name: "Deathful Guns",
    size,
    icon: "turrets_of_death.png",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "ancientPyramids",
        level: 1,
      },
    ],
    nodePosition: { x: -3, y: 1 },
    maxLevel: 5,
    achievementId: "deathfulGuns",
    bricks: ({ mapLevel }) => {
      const satelliteCount = 8;
      const satelliteRadius = 80;
      const orbitRadius = 350 + satelliteRadius;

      const bricks = satellites.map((position) => {
        return circleWithBricks(
          "smallIron",
          {
            center: position,
            innerRadius: satelliteRadius * 0.6,
            outerRadius: satelliteRadius,
          },
          { level: mapLevel },
        );
      });

      return [...bricks];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return satellites.map((position) => {
        return {
          type: "bigGun",
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
    mapsRequired: { ancientPyramids: 1 },
  } satisfies MapConfig;
})();

export default mapConfig;
