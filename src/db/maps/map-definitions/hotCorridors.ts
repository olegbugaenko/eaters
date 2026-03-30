import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { bezierCurveWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

const CIRCLE_KAPPA = 0.5522847498307936;

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

const mapConfig = (() => {
  const size: SceneSize = { width: 2000, height: 2000 };
  const spawnPoint: SceneVector2 = { x: 320, y: 1000 };

  const enemyPositions: readonly SceneVector2[] = [
    { x: 520, y: 1000 },
    { x: 860, y: 320 },
    { x: 1360, y: 360 },
    { x: 1680, y: 1000 },
    { x: 1360, y: 1640 },
    { x: 880, y: 1690 },
    { x: 520, y: 1200 },
  ];

  const turretPositions: readonly SceneVector2[] = [
    { x: 1000, y: 260 },
    { x: 1720, y: 1000 },
    { x: 1000, y: 1740 },
    { x: 280, y: 1000 },
  ];

  const outerWallSegments = createRoundedLoopSegments(size, 180, 280);
  const innerWallSegments = createRoundedLoopSegments(size, 460, 220);

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
            spacing: 1,
            sampleStep: 8,
            thickness: 120,
          },
          { level: baseLevel + 2 },
        ),
        bezierCurveWithBricks(
          "smallMagma",
          {
            segments: innerWallSegments,
            spacing: 1,
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
