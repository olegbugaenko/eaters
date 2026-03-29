import type {
  SceneSize,
  SceneVector2,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import { squareWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const TENTACLE_COUNT = 8;
const SEGMENTS_PER_TENTACLE = 5;
const POINTS_PER_TENTACLE = SEGMENTS_PER_TENTACLE + 1;
const BASE_RADIUS = 48;
const TIP_RADIUS = 180;

const mapConfig = (() => {
  const size: SceneSize = { width: 1200, height: 1200 };
  const center: SceneVector2 = { x: 600, y: 600 };
  const spawnPoint: SceneVector2 = { x: 200, y: 600 };

  const computeSpineWorldPositions = (tentacleIdx: number): SceneVector2[] => {
    const angle = (tentacleIdx / TENTACLE_COUNT) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return Array.from({ length: POINTS_PER_TENTACLE }, (_, i) => {
      const frac = i / (POINTS_PER_TENTACLE - 1);
      const r = BASE_RADIUS + frac * (TIP_RADIUS - BASE_RADIUS);
      const wobble = Math.sin(frac * Math.PI * 2 + tentacleIdx) * 12 * frac;
      const perpCos = -sin;
      const perpSin = cos;
      return {
        x: center.x + cos * r + perpCos * wobble,
        y: center.y + sin * r + perpSin * wobble,
      };
    });
  };

  return {
    name: "The Great Octopus",
    size,
    icon: "great_octopus.png",
    lockedForDemo: true,
    achievementId: "great_octopus" as const,
    spawnPoints: [spawnPoint],
    unlockedBy: [
      {
        type: "map" as const,
        id: "encagedBeast" as const,
        level: 1,
      },
    ],
    nodePosition: { x: -4, y: 2 },
    maxLevel: 5,
    bricks: () => [],
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      const bodyId = "octopus_body";
      const enemies: EnemySpawnData[] = [];

      enemies.push({
        id: bodyId,
        type: "greatOctopusBody",
        level,
        position: center,
      });

      for (let t = 0; t < TENTACLE_COUNT; t++) {
        const spinePositions = computeSpineWorldPositions(t);
        const segmentIds: string[] = [];

        for (let s = 0; s < SEGMENTS_PER_TENTACLE; s++) {
          segmentIds.push(`tentacle_${t}_seg_${s}`);
        }

        for (let s = 0; s < SEGMENTS_PER_TENTACLE; s++) {
          const p0 = spinePositions[s]!;
          const p1 = spinePositions[s + 1]!;
          const segPosition: SceneVector2 = {
            x: (p0.x + p1.x) / 2,
            y: (p0.y + p1.y) / 2,
          };

          enemies.push({
            id: segmentIds[s],
            type: "greatOctopusSegment",
            level,
            position: segPosition,
            linkedEnemyIds: segmentIds.slice(s + 1),
            bodyEnemyId: bodyId,
            tentacleIndex: t,
            segmentIndex: s,
          } satisfies EnemySpawnData);
        }
      }

      return enemies;
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    mapsRequired: { encagedBeast: 1 },
  } satisfies MapConfig;
})();

export default mapConfig;
