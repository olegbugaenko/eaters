import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  bezierCurveWithBricks,
  circleWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };
  const outerRadius = 520;
  const innerRadius = 390;
  const wireWidth = outerRadius - innerRadius + 20;

  return {
    name: "Coil",
    size,
    icon: "coil.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 1 },
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const ringLevel = baseLevel + 3;
      const wireLevel = baseLevel + 2;

      const base = circleWithBricks(
        "smallSquareGray",
        {
          center,
          innerRadius,
          outerRadius,
        },
        { level: ringLevel },
      );

      const wires = [];

      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const position = {
          x: center.x + outerRadius + 50 * Math.cos(angle),
          y: center.y + outerRadius + 50 * Math.sin(angle),
        };
        const copperWire = bezierCurveWithBricks(
          "smallCopper",
          {
            segments: [
              {
                start: {
                  x: center.x + innerRadius * Math.cos(angle),
                  y: center.y + innerRadius * Math.sin(angle),
                },
                control1: {
                  x:
                    center.x +
                    innerRadius * Math.cos(angle + 0.1) +
                    (wireWidth / 3) * Math.cos(angle + 0.1),
                  y:
                    center.y +
                    innerRadius * Math.sin(angle + 0.1) +
                    (wireWidth / 3) * Math.sin(angle + 0.1),
                },
                control2: {
                  x:
                    center.x +
                    innerRadius * Math.cos(angle + 0.1) +
                    ((2 * wireWidth) / 3) * Math.cos(angle + 0.1),
                  y:
                    center.y +
                    innerRadius * Math.sin(angle + 0.1) +
                    ((2 * wireWidth) / 3) * Math.sin(angle + 0.1),
                },
                end: {
                  x: center.x + (innerRadius + wireWidth) * Math.cos(angle),
                  y: center.y + (innerRadius + wireWidth) * Math.sin(angle),
                },
              },
            ],
            spacing: 26,
            rotationOffset: Math.PI / 2,
          },
          { level: wireLevel },
        );
        wires.push(copperWire);
      }
      return [base, ...wires];
    },
    enemies: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      return [
        {
          type: "plasmaBeamTurretEnemy",
          level: baseLevel,
          position: { x: center.x - 100, y: center.y - 150 },
        } satisfies EnemySpawnData,
        {
          type: "plasmaBeamTurretEnemy",
          level: baseLevel,
          position: { x: center.x - 100, y: center.y + 150 },
        } satisfies EnemySpawnData,
        {
          type: "plasmaBeamTurretEnemy",
          level: baseLevel,
          position: { x: center.x + 150, y: center.y },
        } satisfies EnemySpawnData,
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
        id: "wire",
        level: 1,
      },
    ],
    mapsRequired: { wire: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
