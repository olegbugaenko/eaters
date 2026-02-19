import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  templateWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const center: SceneVector2 = { x: 500, y: 600 };
  const size: SceneSize = { width: 1000, height: 1000 };
  const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 300 };

  // Простий шаблон цифри "1"
  const numberOneTemplate: readonly string[] = [
    " ####      ##      #####",
    " #        #  #       #",
    " ####     ####       #",
    " #       #    #      #",
    " ####   #      #     #",
  ];

  return {
    name: "Weird Bricks",
    size,
    spawnPoints: [spawnPoint],
    icon: "eat.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));

      const numberOne = templateWithBricks(
        "smallTrainingBrick",
        {
          center,
          template: numberOneTemplate,
          horizontalGap: 1,
          verticalGap: 1,
        },
        { level: baseLevel },
      );

      return [numberOne];
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    nodePosition: { x: -1, y: -1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
