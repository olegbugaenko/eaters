import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierCurveWithBricks,
  spiralSleeveWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";

// Nautilus (ammonite) shell:
//   - a single Archimedean spiral sleeve, 2.5 turns, for the shell walls
//   - 12 bezier septa (chamber walls) dividing the spiral into cells
//   - Fire Parasites placed 2–3 per chamber

const INNER_R = 28;
const RADIUS_STEP = 210; // px of radial growth per full revolution
const TURNS = 2.5;
const SPIRAL_WIDTH = 46;
const START_ANGLE = -Math.PI / 2; // spiral arm begins pointing straight up
const PARTITION_STEP = (2 * Math.PI) / 8; // one septum every 45°

/** Archimedean spiral radius at total-traversed angle t. */
const spiralR = (t: number): number =>
  INNER_R + (RADIUS_STEP * t) / (2 * Math.PI);

const mapConfig = (() => {
  const size: SceneSize = { width: 1400, height: 1400 };
  const cx = 800;
  const cy = 700;
  const spawnPoint: SceneVector2 = { x: 50, y: 250 };

  return {
    name: "Амонітова мушля",
    size,
    spawnPoints: [spawnPoint],
    lockedForDemo: true,
    nodePosition: { x: 0, y: -2 },
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const sandLevel = baseLevel + 6;

      // ── Main spiral body ──────────────────────────────────────────────────
      const spiralBody = spiralSleeveWithBricks(
        "smallSquareYellow",
        {
          center: { x: cx, y: cy },
          innerRadius: INNER_R,
          radiusStep: RADIUS_STEP,
          turns: TURNS,
          width: SPIRAL_WIDTH,
          startAngle: START_ANGLE,
          spacing: 18,
        },
        { level: sandLevel },
      );

      // ── Chamber septa (12 bezier partitions) ─────────────────────────────
      // Septa connect the inner-spiral wall to the outer-spiral wall at the
      // same world angle. Control points bow slightly "backward" (toward the
      // spiral opening) to mimic real ammonite septa geometry.
      const septa = Array.from({ length: 12 }, (_, k) => {
        const t = 2 * Math.PI + k * PARTITION_STEP;
        const worldAngle = START_ANGLE + t;
        const r_inner = spiralR(t - 2 * Math.PI);
        const r_outer = spiralR(t);

        const cosA = Math.cos(worldAngle);
        const sinA = Math.sin(worldAngle);

        // "Backward" unit vector (perpendicular, pointing toward smaller angles)
        const bwX = Math.sin(worldAngle);
        const bwY = -Math.cos(worldAngle);

        const bow = (r_outer - r_inner) * 0.13;

        const ptInner = { x: cx + r_inner * cosA, y: cy + r_inner * sinA };
        const ptOuter = { x: cx + r_outer * cosA, y: cy + r_outer * sinA };
        const c1 = {
          x: ptInner.x + bwX * bow * 0.35,
          y: ptInner.y + bwY * bow * 0.35,
        };
        const c2 = {
          x: ptOuter.x + bwX * bow * 0.65,
          y: ptOuter.y + bwY * bow * 0.65,
        };

        return bezierCurveWithBricks(
          "smallSquareYellow",
          {
            segments: [{ start: ptInner, control1: c1, control2: c2, end: ptOuter }],
            spacing: 18,
            rotationOffset: Math.PI / 2,
          },
          { level: sandLevel },
        );
      });

      return [spiralBody, ...septa];
    },

    enemies: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const enemyLevel = baseLevel + 2;
      const result: EnemySpawnData[] = [];

      // One chamber per pair of adjacent septa (12 chambers total).
      // Enemies are spread evenly along the angular extent of each chamber.
      // Inner 4 chambers → 2 enemies; outer 8 chambers → 3 enemies.
      for (let k = 0; k < 12; k += 1) {
        const t_a = 2 * Math.PI + k * PARTITION_STEP;
        const t_b = t_a + PARTITION_STEP;
        const t_mid = (t_a + t_b) / 2;

        // Midpoint radius between inner and outer spiral walls
        const r_center = spiralR(t_mid) - RADIUS_STEP / 2;

        const count = k < 4 ? 2 : 3;
        for (let j = 0; j < count; j += 1) {
          const t_enemy = t_a + PARTITION_STEP * (j + 1) / (count + 1);
          const worldAngle = START_ANGLE + t_enemy;
          result.push({
            type: "fireParasiteEnemy",
            level: enemyLevel,
            position: {
              x: cx + r_center * Math.cos(worldAngle),
              y: cy + r_center * Math.sin(worldAngle),
            },
          } satisfies EnemySpawnData);
        }
      }

      return result;
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
        id: "desertCrater",
        level: 1,
      },
    ],
    mapsRequired: { desertCrater: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
