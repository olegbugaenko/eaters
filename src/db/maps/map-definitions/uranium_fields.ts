import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 100, y: 100 };

  return {
    name: "Uranium Fields",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 6 },
    icon: "uranium_fields.png",
    lockedForDemo: true,
    mapEffects: ["radioactivity"],
    bricks: ({ mapLevel }) => {
      const numPetals = 3;
      const slicedTrianles = [];

      const radius = 300;

      for (let i = 0; i < numPetals; i++) {
        const angleWidth = Math.PI / (numPetals + 1);
        const angle = (i / numPetals) * 2 * Math.PI - Math.PI / 2;
        const leftAngle = angle - angleWidth / 2;
        const rightAngle = angle + angleWidth / 2;
        const xLeft = center.x + Math.cos(leftAngle) * radius;
        const yLeft = center.y + Math.sin(leftAngle) * radius;
        const xRight = center.x + Math.cos(rightAngle) * radius;
        const yRight = center.y + Math.sin(rightAngle) * radius;
        slicedTrianles.push({
          vertices: [
            { x: center.x, y: center.y },
            { x: xLeft, y: yLeft },
            { x: xRight, y: yRight },
          ],
        });
      }

      const baseLevel = Math.max(0, Math.floor(mapLevel));
      return [
        ...slicedTrianles.map((triangle) =>
          polygonWithBricks("uraniumBrick", triangle, { level: baseLevel }),
        ),
        circleWithBricks(
          "uraniumBrick",
          {
            center,
            innerRadius: radius + 50,
            outerRadius: radius + 120,
          },
          { level: baseLevel },
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
        id: "volcano",
        level: 1,
      },
    ],
    mapsRequired: { volcano: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
