import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };
  const levelOffset = 0;
  const portalOffsets: SceneVector2[] = [
    { x: 0, y: -400 },        // top
    { x: 380.4, y: -123.6 },  // top-right
    { x: 235.1, y: 323.6 },   // bottom-right
    { x: -235.1, y: 323.6 },  // bottom-left
    { x: -380.4, y: -123.6 }, // top-left
  ];

  return {
    name: "Portal Ring",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 0 },
    icon: 'portals.png',
    bricks: () => [],
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel + levelOffset));
      return portalOffsets.map((offset) => ({
        type: "portalSpawnerEnemy",
        level,
        position: {
          x: center.x + offset.x,
          y: center.y + offset.y,
        },
      }));
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
        id: "silverRing",
        level: 1,
      },
    ],
    mapsRequired: { silverRing: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
