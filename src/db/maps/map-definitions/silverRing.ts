import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };
  const outerRadius = 520;
  const innerRadius = 360;
  const gemRadius = 60;

  return {
    name: "Silver Ring",
    size,
    icon: "silver_ring.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 4, y: 0 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const ringLevel = baseLevel;
      const gemLevel = baseLevel + 1;

      const silverRing = circleWithBricks(
        "smallSilver",
        {
          center,
          innerRadius,
          outerRadius,
        },
        { level: ringLevel },
      );

      const copperGem = circleWithBricks(
        "smallCopper",
        {
          center: { x: center.x + outerRadius + 50, y: center.y },
          innerRadius: 0,
          outerRadius: gemRadius * 1.25,
        },
        { level: gemLevel },
      );
      const copperGem2 = circleWithBricks(
        "smallCopper",
        {
          center: { x: center.x + outerRadius - 25, y: center.y + 50 },
          innerRadius: 0,
          outerRadius: gemRadius,
        },
        { level: gemLevel },
      );
      const copperGem3 = circleWithBricks(
        "smallCopper",
        {
          center: { x: center.x + outerRadius - 25, y: center.y - 50 },
          innerRadius: 0,
          outerRadius: gemRadius,
        },
        { level: gemLevel },
      );

      return [silverRing, copperGem, copperGem2, copperGem3];
    },
    /* enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      const offsets: SceneVector2[] = [
        { x: -100, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 100 },
        { x: -100, y: 100 },
      ];
      return offsets.map((offset) => ({
        type: "burstTurretEnemy",
        level,
        position: {
          x: center.x + offset.x,
          y: center.y + offset.y,
        },
      }));
    },*/
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    unlockedBy: [
      {
        type: "map",
        id: "wire",
        level: 1,
      },
    ],
    mapsRequired: { wire: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
