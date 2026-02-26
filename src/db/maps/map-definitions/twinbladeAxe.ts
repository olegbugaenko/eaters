import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { bezierPolygonWithBricks, rectangleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const bladePosition: SceneVector2 = { x: center.x + 100, y: center.y - 100 };
  const spawnPoint: SceneVector2 = { x: 100, y: 100 };

  // Shaft goes from lower-left to upper-right.
  const shaftRotation = -Math.PI / 4;
  const shaftLength = 1200;
  const shaftWidth = 52;

  // Blade shape in local axe space:
  // X axis = along shaft, Y axis = perpendicular to shaft.
  // This outline creates a pointed axe blade rather than a rounded mace-like lobe.
  const baseBladeOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -130, y: 34 },
      control1: { x: -210, y: 70 },
      control2: { x: -250, y: 220 },
      end: { x: -350, y: 300 },
    },
    {
      start: { x: -350, y: 300 },
      control1: { x: -160, y: 420 },
      control2: { x: 160, y: 420 },
      end: { x: 390, y: 320 },
    },
    {
      start: { x: 390, y: 300 },
      control1: { x: 250, y: 220 },
      control2: { x: 210, y: 70 },
      end: { x: 130, y: 34 },
    },
  ];

  const topBlade = transformBezierOutline(baseBladeOutline, {
    rotation: shaftRotation,
    position: bladePosition,
  });

  const bottomBlade = transformBezierOutline(baseBladeOutline, {
    scale: { x: 1, y: -1 },
    rotation: shaftRotation,
    position: bladePosition,
  });

  return {
    name: "Twinblade Axe",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 3 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const axeLevel = baseLevel + 3;

      const shaft = rectangleWithBricks(
        "compactIron",
        {
          center,
          width: shaftLength,
          height: shaftWidth,
          rotation: shaftRotation,
          brickRotation: shaftRotation,
        },
        { level: axeLevel },
      );

      return [
        shaft,
        bezierPolygonWithBricks(
          "compactIron",
          {
            outline: topBlade,
            spacing: 26,
            sampleStep: 1,
            alignToEdge: true,
          },
          { level: axeLevel },
        ),
        bezierPolygonWithBricks(
          "compactIron",
          {
            outline: bottomBlade,
            spacing: 26,
            sampleStep: 1,
            alignToEdge: true,
          },
          { level: axeLevel },
        ),
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      const turretCount = 4;
      const turretRadius = 620;

      const ringTurrets = Array.from({ length: turretCount }, (_, index) => {
        const angle = (index / turretCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * turretRadius,
          y: center.y + Math.sin(angle) * turretRadius,
        };

        return {
          type: "spinningAxeTurretEnemy" as const,
          level,
          position,
        };
      });

      return [
        ...ringTurrets,
        {
          type: "spinningAxeTurretEnemy" as const,
          level,
          position: { ...center },
        },
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
        id: "gear",
        level: 1,
      },
    ],
    mapsRequired: { gear: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
