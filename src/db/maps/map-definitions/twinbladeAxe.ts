import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { bezierPolygonWithBricks, rectangleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { ...center };

  const shaftRotation = Math.PI / 4;
  const shaftLength = 720;
  const shaftWidth = 64;

  const baseBladeOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -90, y: 0 },
      control1: { x: -140, y: -90 },
      control2: { x: -220, y: -220 },
      end: { x: -360, y: -280 },
    },
    {
      start: { x: -360, y: -280 },
      control1: { x: -420, y: -210 },
      control2: { x: -420, y: -40 },
      end: { x: -360, y: 30 },
    },
    {
      start: { x: -360, y: 30 },
      control1: { x: -270, y: 70 },
      control2: { x: -150, y: 45 },
      end: { x: -90, y: 0 },
    },
  ];

  const bladeAlongShaft = transformBezierOutline(baseBladeOutline, {
    rotation: shaftRotation,
    position: center,
  });

  const mirroredBladeAlongShaft = transformBezierOutline(baseBladeOutline, {
    scale: { x: 1, y: -1 },
    rotation: shaftRotation,
    position: center,
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

      const topBlade = bezierPolygonWithBricks(
        "compactIron",
        {
          outline: bladeAlongShaft,
          spacing: 26,
          sampleStep: 0.05,
          alignToEdge: true,
          rotationOffset: shaftRotation,
        },
        { level: axeLevel },
      );

      const bottomBlade = bezierPolygonWithBricks(
        "compactIron",
        {
          outline: mirroredBladeAlongShaft,
          spacing: 26,
          sampleStep: 0.05,
          alignToEdge: true,
          rotationOffset: shaftRotation,
        },
        { level: axeLevel },
      );

      return [shaft, topBlade, bottomBlade];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      const turretCount = 4;
      const turretRadius = 620;

      return Array.from({ length: turretCount }, (_, index) => {
        const angle = (index / turretCount) * Math.PI * 2;
        const position: SceneVector2 = {
          x: center.x + Math.cos(angle) * turretRadius,
          y: center.y + Math.sin(angle) * turretRadius,
        };

        return {
          type: "bleedingTurretEnemy",
          level,
          position,
        };
      });
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
