import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { spiralSleeveWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1600, height: 1000 };
  const spawnPoint: SceneVector2 = { x: size.width - 160, y: 140 };

  return {
    name: "Spiral Sleeves",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 2, y: 0 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const sandLevel = baseLevel + 2;

      return [
        spiralSleeveWithBricks(
          "smallSquareYellow",
          {
            center: { x: 300, y: 320 },
            innerRadius: 24,
            radiusStep: 65,
            turns: 2.8,
            width: 56,
            startAngle: -Math.PI / 2,
            spacing: 18,
          },
          { level: sandLevel },
        ),
        spiralSleeveWithBricks(
          "smallSquareYellow",
          {
            center: { x: 760, y: 280 },
            innerRadius: 16,
            radiusStep: 58,
            turns: 3.2,
            width: 48,
            startAngle: Math.PI / 4,
            clockwise: true,
            spacing: 18,
          },
          { level: sandLevel },
        ),
        spiralSleeveWithBricks(
          "smallSquareYellow",
          {
            center: { x: 1270, y: 330 },
            innerRadius: 20,
            radiusStep: 60,
            turns: 2.7,
            width: 52,
            startAngle: Math.PI,
            spacing: 18,
          },
          { level: sandLevel },
        ),
        spiralSleeveWithBricks(
          "smallSquareYellow",
          {
            center: { x: 520, y: 760 },
            innerRadius: 24,
            radiusStep: 70,
            turns: 2.6,
            width: 54,
            startAngle: -Math.PI / 6,
            clockwise: true,
            spacing: 18,
          },
          { level: sandLevel },
        ),
        spiralSleeveWithBricks(
          "smallSquareYellow",
          {
            center: { x: 1080, y: 730 },
            innerRadius: 28,
            radiusStep: 68,
            turns: 3,
            width: 58,
            startAngle: Math.PI / 2,
            spacing: 18,
          },
          { level: sandLevel },
        ),
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
        id: "sphinx",
        level: 1,
      },
    ],
    mapsRequired: { sphinx: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
