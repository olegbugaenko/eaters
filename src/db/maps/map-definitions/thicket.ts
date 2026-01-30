import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1000, height: 1000 };
  const sandHeight = 60;
  const createRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): SceneVector2[] => [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const cactusStart = size.height - sandHeight - 200;
  const sandVertices = createRectangle(
    0,
    size.height - sandHeight - 200,
    size.width,
    sandHeight,
  );
  const bushClusters: readonly { center: SceneVector2; radius: number }[] = [
    { center: { x: 320, y: 560 }, radius: 110 },
    { center: { x: 500, y: 440 }, radius: 100 },
    { center: { x: 720, y: 500 }, radius: 105 },
    { center: { x: 880, y: 360 }, radius: 115 },
    { center: { x: 620, y: 620 }, radius: 90 },
  ];

  return {
    name: "Overgrown Thicket",
    size,
    icon: "thicket.png",
    spawnPoints: [{ x: 50, y: size.height - sandHeight - 420 }],
    nodePosition: { x: 2, y: 3 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const sandLevel = baseLevel + 1;
      const organicLevel = baseLevel;

      const sandBank = polygonWithBricks(
        "smallSquareYellow",
        {
          vertices: sandVertices,
        },
        { level: sandLevel },
      );

      /*const bushes = bushClusters.map((cluster) =>
        circleWithBricks(
          "smallOrganic",
          {
            center: cluster.center,
            innerRadius: 0,
            outerRadius: cluster.radius,
          },
          { level: organicLevel },
        ),
      );*/

      const cactus = [];

      cactus.push(
        polygonWithBricks(
          "smallOrganic",
          {
            vertices: createRectangle(420, cactusStart - 360, 120, 360),
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: 480, y: cactusStart - 360 },
            innerRadius: 0,
            outerRadius: 60,
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        polygonWithBricks(
          "smallOrganic",
          {
            vertices: createRectangle(280, cactusStart - 460, 90, 310),
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: 320, y: cactusStart - 460 },
            innerRadius: 0,
            outerRadius: 45,
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: 390, y: cactusStart - 160 },
            innerRadius: 0,
            outerRadius: 120,
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        polygonWithBricks(
          "smallOrganic",
          {
            vertices: createRectangle(640, cactusStart - 360, 90, 210),
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: 680, y: cactusStart - 360 },
            innerRadius: 0,
            outerRadius: 45,
          },
          { level: organicLevel },
        ),
      );

      cactus.push(
        circleWithBricks(
          "smallOrganic",
          {
            center: { x: 600, y: cactusStart - 120 },
            innerRadius: 0,
            outerRadius: 120,
          },
          { level: organicLevel },
        ),
      );

      return [sandBank, ...cactus];
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { x: 50, y: size.height - sandHeight - 220 },
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
