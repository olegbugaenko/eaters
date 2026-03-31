import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { bezierCurveWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

/**
 * Closed Bezier path: heater-style shield (top arc, sides, pointed base).
 * Local coords; scaled + centered on map. Rim only — hollow inside.
 */
const shieldPathLocal: readonly BezierCurveSegment[] = [
  {
    start: { x: -230, y: -270 },
    control1: { x: -150, y: -330 },
    control2: { x: -45, y: -365 },
    end: { x: 0, y: -375 },
  },
  {
    start: { x: 0, y: -375 },
    control1: { x: 45, y: -365 },
    control2: { x: 150, y: -330 },
    end: { x: 230, y: -270 },
  },
  {
    start: { x: 230, y: -270 },
    control1: { x: 265, y: -40 },
    control2: { x: 130, y: 260 },
    end: { x: 0, y: 385 },
  },
  {
    start: { x: 0, y: 385 },
    control1: { x: -130, y: 260 },
    control2: { x: -265, y: -40 },
    end: { x: -230, y: -270 },
  },
];

/** Uniform scale vs original outline (~1.5× linear → larger shield, same shape). */
const SHIELD_SCALE = 1.52;

/** Turret ring inside the hollow shield (same center as brick outline). */
const INNER_TURRET_RADIUS = 108;

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 120, y: 120 };

  return {
    name: "Shield of Titans",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 4, y: -2 },
    icon: "shield_of_titans.png",
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const brickLevel = Math.max(0, Math.floor(mapLevel));
      const segments = transformBezierOutline(shieldPathLocal, {
        position: center,
        scale: SHIELD_SCALE,
      });

      return [
        bezierCurveWithBricks(
          "titaniumBrick",
          {
            segments,
            spacing: 28,
            sampleStep: 10,
            thickness: 60,
          },
          { level: brickLevel },
        ),
      ];
    },
    enemies: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const freezeLevel = baseLevel + 6;
      const laserLevel = baseLevel + 4;

      const lasers: EnemySpawnData[] = Array.from({ length: 3 }, (_, index) => {
        const angle = (index / 3) * Math.PI * 2;
        return {
          type: "laserTurretEnemy",
          level: laserLevel,
          position: {
            x: center.x + Math.cos(angle) * INNER_TURRET_RADIUS,
            y: center.y + Math.sin(angle) * INNER_TURRET_RADIUS,
          },
        } satisfies EnemySpawnData;
      });

      const freezes: EnemySpawnData[] = Array.from({ length: 3 }, (_, index) => {
        const angle = Math.PI / 6 + (index / 3) * Math.PI * 2;
        return {
          type: "freezeTurretEnemy",
          level: freezeLevel,
          position: {
            x: center.x + Math.cos(angle) * INNER_TURRET_RADIUS,
            y: center.y + Math.sin(angle) * INNER_TURRET_RADIUS,
          },
        } satisfies EnemySpawnData;
      });

      return [...lasers, ...freezes];
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
        id: "frozenForest",
        level: 1,
      },
    ],
    mapsRequired: { frozenForest: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
