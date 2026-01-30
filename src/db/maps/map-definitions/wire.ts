import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  circleWithBricks,
  connectorWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const cableCenters: readonly SceneVector2[] = [
    { x: 350, y: 350 },
    { x: 520, y: 260 },
    { x: 780, y: 420 },
    { x: 1030, y: 360 },
    { x: 1280, y: 520 },
    { x: 1120, y: 820 },
    { x: 860, y: 960 },
    { x: 620, y: 900 },
    { x: 420, y: 1080 },
  ];

  const spawnPoint: SceneVector2 = { x: 180, y: 300 };

  return {
    name: "Wire",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 4, y: 1 },
    icon: "wire.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const outerLevel = baseLevel + 2;
      const outerRadius = 90;
      const innerRadius = 40;

      const outerSegments = cableCenters.flatMap((center, index) => {
        const circle = circleWithBricks(
          "smallSquareGray",
          {
            center,
            innerRadius: 0,
            outerRadius,
          },
          { level: outerLevel },
        );

        if (index >= cableCenters.length - 1) {
          return [circle];
        }

        const nextCenter = cableCenters[index + 1];
        if (!nextCenter) {
          return [circle];
        }

        const connector = connectorWithBricks(
          "smallSquareGray",
          {
            start: center,
            end: nextCenter,
            width: outerRadius * 2,
          },
          { level: outerLevel },
        );

        return [circle, connector];
      });

      const innerSegments = cableCenters.flatMap((center, index) => {
        const circle = circleWithBricks(
          "smallCopper",
          {
            center,
            innerRadius: 0,
            outerRadius: innerRadius,
          },
          { level: baseLevel },
        );

        if (index >= cableCenters.length - 1) {
          return [circle];
        }

        const nextCenter = cableCenters[index + 1];
        if (!nextCenter) {
          return [circle];
        }

        const connector = connectorWithBricks(
          "smallCopper",
          {
            start: center,
            end: nextCenter,
            width: innerRadius * 2,
          },
          { level: baseLevel },
        );

        return [circle, connector];
      });

      return [...outerSegments, ...innerSegments];
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
        id: "oldForge",
        level: 1,
      },
    ],
    mapsRequired: { oldForge: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
