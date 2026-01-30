import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { getBrickConfig } from "../../bricks-db";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { FOUNDATIONS_CENTER } from "../maps-db.constants";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const center = FOUNDATIONS_CENTER;
  const size: SceneSize = { width: 1000, height: 1000 };
  const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 30 };
  const sides = 5;
  const outerRadius = 360;
  const layerThicknessTraining =
    getBrickConfig("smallTrainingBrick").size.width;
  const layerThicknessGray = getBrickConfig("smallSquareGray").size.width;
  const innerRadius = Math.max(
    outerRadius - layerThicknessTraining - layerThicknessGray,
    0,
  );
  const middleRadius = Math.max(outerRadius - layerThicknessGray, 0);

  const createPolygon = (radius: number): SceneVector2[] =>
    Array.from({ length: sides }, (_, index) => {
      const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
      return {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });

  const outerVertices = createPolygon(outerRadius);
  const innerVertices = createPolygon(innerRadius);
  const middleVertices = createPolygon(middleRadius);
  const expandedVertices = createPolygon(
    outerRadius + getBrickConfig("smallSquareGray").size.width * 1.2,
  );

  return {
    name: "Cracked Pentagon",
    size,
    icon: "pentagon.png",
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map",
        id: "trainingGrounds",
        level: 1,
      },
    ],
    nodePosition: { x: 1, y: 1 },
    mapsRequired: { trainingGrounds: 1 },
    maxLevel: 1,
    bricks: ({ mapLevel }) => [
      polygonWithBricks(
        "smallTrainingBrick",
        {
          vertices: middleVertices,
          holes: [innerVertices],
          offsetX: center.x,
          offsetY: center.y,
        },
        { level: mapLevel },
      ),
      polygonWithBricks(
        "smallSquareGray",
        {
          vertices: outerVertices,
          holes: [middleVertices],
          offsetX: center.x,
          offsetY: center.y,
        },
        { level: mapLevel },
      ),
      ...expandedVertices.map((vertex) =>
        circleWithBricks(
          "smallSquareGray",
          {
            center: vertex,
            innerRadius: 0,
            outerRadius: getBrickConfig("smallSquareGray").size.width * 2.3,
          },
          { level: mapLevel },
        ),
      ),
    ],
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
  } satisfies MapConfig;
})();

export default mapConfig;
