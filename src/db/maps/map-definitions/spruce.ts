import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { polygonWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1700 };
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
  const createTriangle = (
    baseCenter: SceneVector2,
    width: number,
    height: number,
  ): SceneVector2[] => [
    { x: baseCenter.x, y: baseCenter.y - height },
    { x: baseCenter.x + width / 2, y: baseCenter.y },
    { x: baseCenter.x - width / 2, y: baseCenter.y },
  ];

  const treeConfigs: readonly { base: SceneVector2; scale: number }[] = [
    { base: { x: 350, y: 1200 }, scale: 1 },
    { base: { x: 650, y: 1100 }, scale: 0.95 },
    { base: { x: 950, y: 1250 }, scale: 1.1 },
    { base: { x: 1230, y: 1150 }, scale: 0.9 },
    { base: { x: 500, y: 900 }, scale: 0.85 },
    { base: { x: 1050, y: 880 }, scale: 0.9 },
  ];

  const spawnPoint: SceneVector2 = { x: 200, y: 1300 };

  return {
    name: "Forest",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 3, y: 4 },
    icon: "spruce.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const canopyLevel = baseLevel + 1;
      const trunkLevel = baseLevel;

      const trees = treeConfigs.flatMap((tree) => {
        const trunkHeight = 180 * tree.scale;
        const trunkWidth = 60 * tree.scale;
        const trunkBottomY = tree.base.y;
        const trunkTopY = trunkBottomY - trunkHeight;

        const trunk = polygonWithBricks(
          "smallWood",
          {
            vertices: createRectangle(
              tree.base.x - trunkWidth / 2,
              trunkTopY,
              trunkWidth,
              trunkHeight,
            ),
          },
          { level: trunkLevel },
        );

        const canopyLayers = [
          { width: 320, height: 260, offset: 20 },
          { width: 260, height: 220, offset: 120 },
          { width: 190, height: 180, offset: 210 },
        ];

        const canopy = canopyLayers.map((layer) => {
          const baseCenter: SceneVector2 = {
            x: tree.base.x,
            y: trunkTopY + layer.offset * tree.scale,
          };
          return polygonWithBricks(
            "smallOrganic",
            {
              vertices: createTriangle(
                baseCenter,
                layer.width * tree.scale,
                layer.height * tree.scale,
              ),
            },
            { level: canopyLevel },
          );
        });

        return [trunk, ...canopy];
      });

      return trees;
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
        id: "thicket",
        level: 1,
      },
    ],
    mapsRequired: { thicket: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
