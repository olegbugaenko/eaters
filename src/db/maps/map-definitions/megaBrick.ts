import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { templateWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { FOUNDATIONS_CENTER } from "../maps-db.constants";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const center = FOUNDATIONS_CENTER;
  const size: SceneSize = { width: 1000, height: 1000 };
  const spawnPoint: SceneVector2 = { x: 100, y: center.y - 30 };

  // Один цегла по центру
  const singleBrickTemplate: readonly string[] = [" # "];

  return {
    name: "Mega Brick",
    size,
    icon: "mega_brick.png",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "trainingGrounds",
        level: 1,
      },
    ],
    nodePosition: { x: -1, y: 1 },
    maxLevel: 10,
    achievementId: "megaBrick",
    bricks: ({ mapLevel }) => [
      templateWithBricks(
        "megaBrick",
        {
          center,
          template: singleBrickTemplate,
        },
        { level: mapLevel },
      ),
    ],
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    mapsRequired: { trainingGrounds: 1 },
  } satisfies MapConfig;
})();

export default mapConfig;
