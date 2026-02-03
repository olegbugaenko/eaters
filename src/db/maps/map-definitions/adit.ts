import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { polygonWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1200 };
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  // Spawn point in center of central room (400x400)
  const spawnPoint: SceneVector2 = { x: centerX, y: centerY };

  const createRectangle = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): SceneVector2[] => [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  return {
    name: "Adit Corridors",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 4, y: 3 },
    icon: "adit.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const ironLevel = baseLevel;
      const wallThickness = 40;
      const corridorWidth = 250; // 200-300px as requested

      // === CENTRAL ROOM (400x400) ===
      const centralRoomSize = 400;
      const centralRoomX = centerX - centralRoomSize / 2;
      const centralRoomY = centerY - centralRoomSize / 2;

      // === MAZE WALLS (iron) ===
      const walls: ReturnType<typeof polygonWithBricks>[] = [];

      // Outer border walls
      walls.push(
        // Top wall
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(100, 100, size.width - 200, wallThickness),
          },
          { level: ironLevel },
        ),
        // Bottom wall
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              100,
              size.height - 100 - wallThickness,
              size.width - 200,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Left wall
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(100, 100, wallThickness, size.height - 200),
          },
          { level: ironLevel },
        ),
        // Right wall
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              size.width - 100 - wallThickness,
              100,
              wallThickness,
              size.height - 200,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Central room walls (surrounding the 400x400 room)
      walls.push(
        // Top wall of central room
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centralRoomX - wallThickness,
              centralRoomY - wallThickness,
              centralRoomSize + wallThickness * 2,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom wall of central room
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centralRoomX - wallThickness,
              centralRoomY + centralRoomSize,
              centralRoomSize + wallThickness * 2,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Left wall of central room
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centralRoomX - wallThickness,
              centralRoomY,
              wallThickness,
              centralRoomSize,
            ),
          },
          { level: ironLevel },
        ),
        // Right wall of central room
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centralRoomX + centralRoomSize,
              centralRoomY,
              wallThickness,
              centralRoomSize,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Maze corridors - create walls around corridors (corridors are open spaces)
      // Top corridor walls (vertical walls on sides of corridor)
      const topCorridorY = 100 + wallThickness;
      const topCorridorHeight = centralRoomY - topCorridorY;
      walls.push(
        // Left wall of top corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centerX - corridorWidth / 2 - wallThickness,
              topCorridorY,
              wallThickness,
              topCorridorHeight,
            ),
          },
          { level: ironLevel },
        ),
        // Right wall of top corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centerX + corridorWidth / 2,
              topCorridorY,
              wallThickness,
              topCorridorHeight,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Bottom corridor walls
      const bottomCorridorY = centralRoomY + centralRoomSize + wallThickness;
      const bottomCorridorHeight =
        size.height - 100 - wallThickness - bottomCorridorY;
      walls.push(
        // Left wall of bottom corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centerX - corridorWidth / 2 - wallThickness,
              bottomCorridorY,
              wallThickness,
              bottomCorridorHeight,
            ),
          },
          { level: ironLevel },
        ),
        // Right wall of bottom corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              centerX + corridorWidth / 2,
              bottomCorridorY,
              wallThickness,
              bottomCorridorHeight,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Left corridor walls (horizontal walls on top/bottom of corridor)
      const leftCorridorX = 100 + wallThickness;
      const leftCorridorWidth = centralRoomX - leftCorridorX;
      walls.push(
        // Top wall of left corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              leftCorridorX,
              centerY - corridorWidth / 2 - wallThickness,
              leftCorridorWidth,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom wall of left corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              leftCorridorX,
              centerY + corridorWidth / 2,
              leftCorridorWidth,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Right corridor walls
      const rightCorridorX = centralRoomX + centralRoomSize + wallThickness;
      const rightCorridorWidth =
        size.width - 100 - wallThickness - rightCorridorX;
      walls.push(
        // Top wall of right corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              rightCorridorX,
              centerY - corridorWidth / 2 - wallThickness,
              rightCorridorWidth,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom wall of right corridor
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              rightCorridorX,
              centerY + corridorWidth / 2,
              rightCorridorWidth,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Additional maze walls (creating dead ends and paths)
      // Horizontal dividers in corners
      walls.push(
        // Top-left corner divider
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(200, 300, 300, wallThickness),
          },
          { level: ironLevel },
        ),
        // Top-right corner divider
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(1000, 300, 300, wallThickness),
          },
          { level: ironLevel },
        ),
        // Bottom-left corner divider
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              200,
              size.height - 100 - wallThickness - 300,
              300,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom-right corner divider
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              1000,
              size.height - 100 - wallThickness - 300,
              300,
              wallThickness,
            ),
          },
          { level: ironLevel },
        ),
      );

      // Vertical dividers in corners
      walls.push(
        // Top-left vertical
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              400,
              100 + wallThickness,
              wallThickness,
              200,
            ),
          },
          { level: ironLevel },
        ),
        // Top-right vertical
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              1100,
              100 + wallThickness,
              wallThickness,
              200,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom-left vertical
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              400,
              size.height - 100 - wallThickness - 200,
              wallThickness,
              200,
            ),
          },
          { level: ironLevel },
        ),
        // Bottom-right vertical
        polygonWithBricks(
          "compactIron",
          {
            vertices: createRectangle(
              1100,
              size.height - 100 - wallThickness - 200,
              wallThickness,
              200,
            ),
          },
          { level: ironLevel },
        ),
      );

      return walls;
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
