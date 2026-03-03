import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { getBrickConfig } from "../../bricks-db";
import { squareWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1000, height: 1000 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const outerSize = 700;
  const cavitySize = 500;

  const enemySpawnPosition: SceneVector2 = {
    x: center.x,
    y: center.y + outerSize / 2 + 20,
  };

  return {
    name: "Old Forge",
    size,
    icon: "forge.png",
    spawnPoints: [{ x: center.x, y: center.y - outerSize / 2 + 80 }],
    /*enemySpawnPoints: [
      {
        position: enemySpawnPosition,
        spawnRate: 0.2, // 1 ворог на 5 секунд (1/5 = 0.2)
        enemyTypes: [
          { type: "tankEnemy", weight: 1.0 },
          { type: "fastEnemy", weight: 1.0 },
        ],
        maxConcurrent: 10,
      },
    ],*/
    nodePosition: { x: 3, y: 2 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const walkwayLevel = baseLevel + 1;
      const ironThickness = getBrickConfig("smallIron").size.width;
      const innerRingSize = Math.max(cavitySize - ironThickness * 8, 0);

      const forgeFloor = squareWithBricks(
        "smallSquareGray",
        {
          center,
          size: outerSize,
          innerSize: cavitySize,
        },
        { level: walkwayLevel },
      );

      const ironLining = squareWithBricks(
        "smallIron",
        {
          center,
          size: cavitySize,
          innerSize: innerRingSize > 0 ? innerRingSize : undefined,
        },
        { level: baseLevel },
      );

      return [forgeFloor, ironLining];
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { x: center.x, y: center.y - outerSize / 2 + 80 },
      },
    ],
    unlockedBy: [
      {
        type: "map",
        id: "initial",
        level: 1,
      },
    ],
    mapsRequired: { initial: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
