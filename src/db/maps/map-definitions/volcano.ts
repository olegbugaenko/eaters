import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 200, y: size.height - 200 };
  const volcanoBaseRadius = 400;
  const volcanoInnerRadius = 200;
  const magmaFlowRadius = 80;

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

  const magmaFlowPaths: readonly {
    center: SceneVector2;
    length: number;
    angle: number;
  }[] = [
    {
      center: { x: center.x - 300, y: center.y + 200 },
      length: 200,
      angle: 0.5,
    },
    {
      center: { x: center.x + 250, y: center.y + 150 },
      length: 180,
      angle: -0.3,
    },
    { center: { x: center.x, y: center.y + 300 }, length: 220, angle: 0 },
    {
      center: { x: center.x - 200, y: center.y - 100 },
      length: 150,
      angle: 1.2,
    },
    {
      center: { x: center.x + 300, y: center.y - 150 },
      length: 170,
      angle: -1.0,
    },
  ];

  return {
    name: "Volcano",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 5 },
    icon: "volcano.png",
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const copperLevel = baseLevel + 3;
      const magmaLevel = baseLevel;
      const magmaCraterLevel = 1;

      const volcanoBase = circleWithBricks(
        "smallCopper",
        {
          center,
          innerRadius: volcanoInnerRadius,
          outerRadius: volcanoBaseRadius,
        },
        { level: copperLevel },
      );

      const volcanoCore = circleWithBricks(
        "smallMagma",
        {
          center,
          innerRadius: 0,
          outerRadius: volcanoInnerRadius - 40,
        },
        { level: magmaCraterLevel },
      );

      const magmaFlows = magmaFlowPaths.map((flow) =>
        circleWithBricks(
          "smallMagma",
          {
            center: flow.center,
            innerRadius: 0,
            outerRadius: magmaFlowRadius,
          },
          { level: magmaLevel },
        ),
      );

      return [volcanoBase, volcanoCore, ...magmaFlows];
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
        id: "mine",
        level: 1,
      },
    ],
    mapsRequired: { mine: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
