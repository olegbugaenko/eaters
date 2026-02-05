import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks, rectangleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { ...center };

  return {
    name: "Gear",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 3 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const gearLevel = baseLevel + 2;
      const innerRadius = 260;
      const outerRadius = 340;
      const toothWidth = 120;
      const toothHeight = 60;
      const toothRadius = outerRadius + toothHeight / 2 + 20;

      const circle = circleWithBricks(
        "compactIron",
        { center, innerRadius, outerRadius },
        { level: gearLevel },
      );

      const teeth = Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI / 4) * index;
        const toothCenter: SceneVector2 = {
          x: center.x + Math.cos(angle) * toothRadius,
          y: center.y + Math.sin(angle) * toothRadius,
        };

        return rectangleWithBricks(
          "compactIron",
          {
            center: toothCenter,
            width: toothWidth,
            height: toothHeight,
            rotation: angle,
            brickRotation: angle,
          },
          { level: gearLevel },
        );
      });

      return [circle, ...teeth];
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
        id: "adit",
        level: 1,
      },
    ],
    mapsRequired: { adit: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
