import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { ...center };
  const turretCount = 12;
  const turretRadius = 350;

  return {
    name: "Кратер в пустелі",
    size,
    spawnPoints: [spawnPoint],
    lockedForDemo: true,
    nodePosition: { x: 1, y: -1 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const sandLevel = baseLevel + 5;

      const innerRing = circleWithBricks(
        "smallSquareYellow",
        {
          center,
          innerRadius: 200,
          outerRadius: 300,
        },
        { level: sandLevel },
      );

      const outerRing = circleWithBricks(
        "smallSquareYellow",
        {
          center,
          innerRadius: 420,
          outerRadius: 500,
        },
        { level: sandLevel },
      );

      return [innerRing, outerRing];
    },
    enemies: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const turretLevel = baseLevel + 2;
      const step = (Math.PI * 2) / turretCount;

      const turrets: EnemySpawnData[] = [];
      for (let index = 0; index < turretCount; index += 1) {
        const angle = index * step;
        turrets.push({
          type: index % 2 === 0 ? "plasmaBeamTurretEnemy" : "bleedingTurretEnemy",
          level: turretLevel,
          position: {
            x: center.x + Math.cos(angle) * turretRadius,
            y: center.y + Math.sin(angle) * turretRadius,
          },
        } satisfies EnemySpawnData);
      }
      return turrets;
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
        id: "spiralSleeves",
        level: 1,
      },
    ],
    mapsRequired: { spiralSleeves: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
