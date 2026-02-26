import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 120, y: size.height - 150 };

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

  return {
    name: "Geological Excavations",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 6 },
    icon: "geological_excavations.png",
    lockedForDemo: false,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const stoneLevel = baseLevel + 7;
      const coalLevel = baseLevel + 3;

      const bricks: ReturnType<typeof circleWithBricks>[] = [];

      // Excavation pits: stone ring (crust) on top, coal exposed in the center
      const pits: { x: number; y: number; outerR: number; coalR: number }[] = [
        { x: center.x - 280, y: center.y - 180, outerR: 180, coalR: 100 },
        { x: center.x + 220, y: center.y - 120, outerR: 160, coalR: 85 },
        { x: center.x + 100, y: center.y + 200, outerR: 150, coalR: 75 },
        { x: center.x - 350, y: center.y + 100, outerR: 140, coalR: 70 },
        { x: center.x + 350, y: center.y + 80, outerR: 130, coalR: 65 },
      ];

      pits.forEach(({ x, y, outerR, coalR }) => {
        bricks.push(
          circleWithBricks(
            "smallCoal",
            {
              center: { x, y },
              innerRadius: 0,
              outerRadius: coalR,
            },
            { level: coalLevel },
          ),
        );
        bricks.push(
          circleWithBricks(
            "smallSquareGray",
            {
              center: { x, y },
              innerRadius: coalR,
              outerRadius: outerR,
            },
            { level: stoneLevel },
          ),
        );
      });

      // Large stone slab with excavation trench (coal visible through)
      const slabX = center.x - 200;
      const slabY = center.y - 350;
      const slabWidth = 400;
      const slabHeight = 220;
      const trenchWidth = 180;
      const trenchHeight = 120;
      const trenchX = slabX + (slabWidth - trenchWidth) / 2;
      const trenchY = slabY + (slabHeight - trenchHeight) / 2;

      const stoneSlab = polygonWithBricks(
        "smallSquareGray",
        {
          vertices: createRectangle(slabX, slabY, slabWidth, slabHeight),
          holes: [
            createRectangle(trenchX, trenchY, trenchWidth, trenchHeight),
          ],
        },
        { level: stoneLevel },
      );

      const coalInTrench = polygonWithBricks(
        "smallCoal",
        {
          vertices: createRectangle(trenchX, trenchY, trenchWidth, trenchHeight),
        },
        { level: coalLevel },
      );

      return [
        ...bricks,
        coalInTrench,
        stoneSlab,
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return [
        { type: "freezeTurretEnemy" as const, level, position: { x: center.x - 400, y: center.y - 250 } },
        { type: "freezeTurretEnemy" as const, level, position: { x: center.x + 420, y: center.y - 200 } },
        { type: "bleedingTurretEnemy" as const, level, position: { x: center.x, y: center.y + 350 } },
        { type: "laserTurretEnemy" as const, level, position: { x: center.x - 200, y: center.y + 80 } },
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
        id: "coalConvoy",
        level: 1,
      },
    ],
    mapsRequired: { coalConvoy: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
