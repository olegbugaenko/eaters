import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { bezierCurveWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

const CIRCLE_KAPPA = 0.5522847498307936;
const TAU = Math.PI * 2;

const createRoundedLoopSegments = (
  size: SceneSize,
  inset: number,
  cornerRadius: number,
): readonly BezierCurveSegment[] => {
  const left = inset;
  const right = size.width - inset;
  const top = inset;
  const bottom = size.height - inset;
  const radius = Math.min(cornerRadius, (right - left) / 2, (bottom - top) / 2);
  const handle = radius * CIRCLE_KAPPA;

  return [
    {
      start: { x: left + radius, y: top },
      control1: { x: left + radius + handle, y: top },
      control2: { x: right - radius - handle, y: top },
      end: { x: right - radius, y: top },
    },
    {
      start: { x: right - radius, y: top },
      control1: { x: right - radius + handle, y: top },
      control2: { x: right, y: top + radius - handle },
      end: { x: right, y: top + radius },
    },
    {
      start: { x: right, y: top + radius },
      control1: { x: right, y: top + radius + handle },
      control2: { x: right, y: bottom - radius - handle },
      end: { x: right, y: bottom - radius },
    },
    {
      start: { x: right, y: bottom - radius },
      control1: { x: right, y: bottom - radius + handle },
      control2: { x: right - radius + handle, y: bottom },
      end: { x: right - radius, y: bottom },
    },
    {
      start: { x: right - radius, y: bottom },
      control1: { x: right - radius - handle, y: bottom },
      control2: { x: left + radius + handle, y: bottom },
      end: { x: left + radius, y: bottom },
    },
    {
      start: { x: left + radius, y: bottom },
      control1: { x: left + radius - handle, y: bottom },
      control2: { x: left, y: bottom - radius + handle },
      end: { x: left, y: bottom - radius },
    },
    {
      start: { x: left, y: bottom - radius },
      control1: { x: left, y: bottom - radius - handle },
      control2: { x: left, y: top + radius + handle },
      end: { x: left, y: top + radius },
    },
    {
      start: { x: left, y: top + radius },
      control1: { x: left, y: top + radius - handle },
      control2: { x: left + radius - handle, y: top },
      end: { x: left + radius, y: top },
    },
  ];
};

const createChaoticLoopSegments = (
  size: SceneSize,
  inset: number,
  cornerRadius: number,
  distortion: number,
): readonly BezierCurveSegment[] => {
  const baseSegments = createRoundedLoopSegments(size, inset, cornerRadius);

  return baseSegments.map((segment, index) => {
    const indexRatio = index / baseSegments.length;
    const angleA = indexRatio * TAU;
    const angleB = (indexRatio + 0.37) * TAU;
    const angleC = (indexRatio + 0.73) * TAU;

    return {
      ...segment,
      control1: {
        x: segment.control1.x + Math.cos(angleA) * distortion * 0.7,
        y: segment.control1.y + Math.sin(angleB) * distortion,
      },
      control2: {
        x: segment.control2.x + Math.sin(angleC) * distortion * 0.9,
        y: segment.control2.y + Math.cos(angleA) * distortion * 0.8,
      },
    };
  });
};

const createInnerLoopWithLeftChamberSegments = (
  size: SceneSize,
  inset: number,
  cornerRadius: number,
  distortion: number,
): readonly BezierCurveSegment[] => {
  const chaoticSegments = [...createChaoticLoopSegments(size, inset, cornerRadius, distortion)];
  const left = inset;

  chaoticSegments.splice(
    6,
    1,
    {
      start: { x: left, y: 1420 },
      control1: { x: left + 12, y: 1330 },
      control2: { x: left + 92, y: 1235 },
      end: { x: left + 150, y: 1180 },
    },
    {
      start: { x: left + 150, y: 1180 },
      control1: { x: left + 240, y: 1190 },
      control2: { x: left + 320, y: 1300 },
      end: { x: left + 400, y: 1000 },
    },
    // play here
    {
      start: { x: left + 400, y: 1000 },
      control1: { x: left + 320, y: 700 },
      control2: { x: left + 240, y: 810 },
      end: { x: left + 150, y: 820 },
    },
    {
      start: { x: left + 150, y: 820 },
      control1: { x: left + 92, y: 865 },
      control2: { x: left + 12, y: 770 },
      end: { x: left, y: 680 },
    },
  );

  return chaoticSegments;
};

const mapConfig = (() => {
  const size: SceneSize = { width: 2000, height: 2000 };
  const spawnPoint: SceneVector2 = { x: 520, y: 1000 };

  const enemyPositions: readonly SceneVector2[] = [
    { x: 340, y: 1000 },
    { x: 720, y: 300 },
    { x: 1000, y: 300 },
    { x: 1280, y: 300 },
    { x: 1660, y: 1000 },
    { x: 1280, y: 1700 },
    { x: 720, y: 1700 },
  ];

  const turretPositions: readonly SceneVector2[] = [
    { x: 1000, y: 260 },
    { x: 1720, y: 1000 },
    { x: 1000, y: 1590 },
    { x: 280, y: 1000 },
  ];

  const outerWallSegments = createChaoticLoopSegments(size, 180, 280, 120);
  const innerWallSegments = createInnerLoopWithLeftChamberSegments(size, 460, 220, 90);

  return {
    name: "Hot Corridors",
    size,
    icon: "volcano.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 5 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));

      return [
        bezierCurveWithBricks(
          "smallMagma",
          {
            segments: outerWallSegments,
            spacing: 14,
            sampleStep: 8,
            thickness: 120,
          },
          { level: baseLevel + 2 },
        ),
        bezierCurveWithBricks(
          "smallMagma",
          {
            segments: innerWallSegments,
            spacing: 14,
            sampleStep: 8,
            thickness: 110,
          },
          { level: baseLevel + 2 },
        ),
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));

      return [
        ...enemyPositions.map(
          (position) =>
            ({
              type: "fireParasiteEnemy",
              level,
              position,
            }) satisfies EnemySpawnData,
        ),
        ...turretPositions.map(
          (position) =>
            ({
              type: "hotCorridorTurretEnemy",
              level: level + 1,
              position,
            }) satisfies EnemySpawnData,
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
