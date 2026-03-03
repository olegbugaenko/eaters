import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1300 };
  const center: SceneVector2 = { x: size.width / 2, y: (size.height - 100) / 2 };
  const shaftRadius = 320;
  const wallThickness = 120;
  const entryWidth = 140;
  const spawnPoint: SceneVector2 = { x: center.x, y: size.height - 260 };

  const createSupport = (
    angle: number,
    length: number,
    width: number,
  ): SceneVector2[] => {
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
        { level: wallLevel },
      );

      const coalVein = circleWithBricks(
        "smallCoal",
        {
          center,
          innerRadius: 0,
          outerRadius: shaftRadius - 40,
        },
        { level: baseLevel },
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
        { level: wallLevel },
      );

      const supports = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
        (angle) =>
          polygonWithBricks(
            "smallIron",
            {
              vertices: createSupport(
                angle,
                shaftRadius + wallThickness * 0.45,
                30,
              ),
            },
            { level: wallLevel },
          ),
      );

      return [ironWalls, coalVein, entryTunnel, ...supports];
    },
    enemies: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      return [
        {
          type: "laserTurretEnemy",
          level: baseLevel,
          position: { x: 100, y: center.y },
        } satisfies EnemySpawnData,
        {
          type: "laserTurretEnemy",
          level: baseLevel,
          position: { x: size.width - 100, y: center.y },
        } satisfies EnemySpawnData,
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
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
