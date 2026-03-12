import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  circleWithBricks,
  spiralSleeveWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1800, height: 1800 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 180, y: center.y };

  const turretRadius = 265;
  const turretAngles = [
    -Math.PI / 2,
    -Math.PI / 10,
    Math.PI / 3,
    (5 * Math.PI) / 6,
    (7 * Math.PI) / 6,
    (3 * Math.PI) / 2,
  ] as const;

  return {
    name: "Transformer",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 7, y: 1 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const copperLevel = baseLevel + 4;

      const spiral = spiralSleeveWithBricks(
        "smallCopper",
        {
          center,
          innerRadius: 120,
          radiusStep: 1180,
          turns: 3.75,
          width: 84,
          startAngle: -Math.PI / 2,
          clockwise: true,
          spacing: 18,
        },
        { level: copperLevel },
      );

      const core = circleWithBricks(
        "smallCopper",
        {
          center,
          outerRadius: 110,
        },
        { level: copperLevel + 1 },
      );

      return [spiral, core];
    },
    enemies: () => {
      return turretAngles.map((angle) => ({
        type: "plasmaBeamTurretEnemy",
        level: 5,
        position: {
          x: center.x + Math.cos(angle) * turretRadius,
          y: center.y + Math.sin(angle) * turretRadius,
        },
      })) satisfies readonly EnemySpawnData[];
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
        id: "unknownKnightMonument",
        level: 1,
      },
    ],
    mapsRequired: { unknownKnightMonument: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
