import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { templateWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { FOUNDATIONS_CENTER } from "../maps-db.constants";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const center = FOUNDATIONS_CENTER;
  const size: SceneSize = { width: 1200, height: 1200 };
  const spawnPoint: SceneVector2 = { x: 150, y: 150 };
  const pyramidTemplate: readonly string[] = [
    "           #           ",
    "          ###          ",
    "         #####         ",
    "        #######        ",
    "       #########       ",
    "      ###########      ",
    "     #############     ",
    "    ###############    ",
    "   #################   ",
    "  ###################  ",
    " ##################### ",
    "#######################",
  ];

  return {
    name: "Ancient Piramids",
    size,
    icon: "pyramids.png",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "megaBrick",
        level: 1,
      },
    ],
    nodePosition: { x: -2, y: 1 },
    maxLevel: 5,
    achievementId: "ancientPyramids",
    bricks: ({ mapLevel }) => {
      const pyramidLevel = Math.max(1, Math.floor(mapLevel)) + 1;
      return [
        templateWithBricks(
          "smallSquareYellow",
          {
            center,
            template: pyramidTemplate,
            horizontalGap: 1,
            verticalGap: 1,
          },
          { level: pyramidLevel },
        ),
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      const turretCount = 4;
      const turretRadius = 320;
      return Array.from({ length: turretCount }, (_, index) => {
        const angle = (index / turretCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * turretRadius,
          y: center.y + Math.sin(angle) * turretRadius,
        };
        return {
          type: "freezeTurretEnemy",
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
    mapsRequired: { megaBrick: 1 },
  } satisfies MapConfig;
})();

export default mapConfig;
