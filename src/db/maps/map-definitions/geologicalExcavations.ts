import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierPolygonWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import { generateTrapezoidOutline } from "../../../logic/services/brick-layout/outline-patterns";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

// Лезо в локальних координатах «вниз» як у голови в unknownKnightMonument: трапеція з низом по +y, центром у (0,0). Потім зсув щоб шийка була в (0,0), і поворот на кут лопати.
const bladeTrapezoid = generateTrapezoidOutline({
  topWidth: 28,
  bottomWidth: 76,
  height: 52,
  convexity: {top: { control1: 8, control2: 8 }, left: {control1: 14, control2: 19}, right: {control1: 14, control2: 19} },
});
const bladeTrapezoidCenterY = 52 / 2;
const baseShovelBladeOutline: readonly BezierCurveSegment[] = bladeTrapezoid.map((seg) => ({
  start: { x: seg.start.x, y: seg.start.y + bladeTrapezoidCenterY },
  control1: { x: seg.control1.x, y: seg.control1.y + bladeTrapezoidCenterY },
  control2: { x: seg.control2.x, y: seg.control2.y + bladeTrapezoidCenterY },
  end: { x: seg.end.x, y: seg.end.y + bladeTrapezoidCenterY },
}));

const BRICK_THICK = 24; // 1 brick thickness for grid lines
const CELL_W = 300;
const CELL_H = 300;
const GRID_W = 1200;
const GRID_H = 900;

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  // Portal 100x100 top-left → spawn at center of portal
  const spawnPoint: SceneVector2 = { x: 50, y: 50 };

  // Grid 4x3: 1200×900, centered in x, shifted down 400px from map center
  const gridCenterY = center.y + 400;
  const gridLeft = center.x - GRID_W / 2;
  const gridRight = center.x + GRID_W / 2;
  const gridTop = gridCenterY - GRID_H / 2;
  const gridBottom = gridCenterY + GRID_H / 2;

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

  const cellInner = (col: number, row: number) => {
    const left = gridLeft + BRICK_THICK + col * CELL_W;
    const top = gridTop + BRICK_THICK + row * CELL_H;
    return {
      left,
      top,
      right: left + CELL_W - BRICK_THICK * 2,
      bottom: top + CELL_H - BRICK_THICK * 2,
      width: CELL_W - BRICK_THICK * 2,
      height: CELL_H - BRICK_THICK * 2,
    };
  };

  return {
    name: "Geological Excavations",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 6 },
    icon: "geological_excavations.png",
    lockedForDemo: false,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const SAND_LEVEL = 5;
      const COAL_LEVEL = 3;

      const bricks: ReturnType<typeof polygonWithBricks>[] = [];

      // --- 1. Shovel (compactIron), third cell from left (col 2), top row, 70° — anchor at top of cell so blade barely in ---
      const shovelCell = cellInner(2, 0);
      const bladeAnchorX = (shovelCell.left + shovelCell.right) / 2;
      const bladeAnchorY = shovelCell.top + 8;
      const angleDeg = 70;
      const angleRad = (angleDeg * Math.PI) / 180;
      const cosA = Math.cos(angleRad);
      const sinA = Math.sin(angleRad);
      const handleLen = 420;
      const handleHalfW = 20;
      const dirX = cosA;
      const dirY = -sinA;
      const perpX = sinA;
      const perpY = cosA;
      const handleTopX = bladeAnchorX + handleLen * dirX;
      const handleTopY = bladeAnchorY + handleLen * dirY;
      const h0: SceneVector2 = { x: bladeAnchorX - perpX * handleHalfW, y: bladeAnchorY - perpY * handleHalfW };
      const h1: SceneVector2 = { x: bladeAnchorX + perpX * handleHalfW, y: bladeAnchorY + perpY * handleHalfW };
      const h2: SceneVector2 = { x: handleTopX + perpX * handleHalfW, y: handleTopY + perpY * handleHalfW };
      const h3: SceneVector2 = { x: handleTopX - perpX * handleHalfW, y: handleTopY - perpY * handleHalfW };
      const handleOutline: readonly BezierCurveSegment[] = [
        { start: h0, control1: h0, control2: h1, end: h1 },
        { start: h1, control1: h1, control2: h2, end: h2 },
        { start: h2, control1: h2, control2: h3, end: h3 },
        { start: h3, control1: h3, control2: h0, end: h0 },
      ];
      bricks.push(
        bezierPolygonWithBricks(
          "compactIron",
          { outline: handleOutline, spacing: 20, sampleStep: 8, alignToEdge: true },
          { level: baseLevel + 2 },
        ),
      );
      const bladeOutline = transformBezierOutline(baseShovelBladeOutline, {
        position: { x: bladeAnchorX, y: bladeAnchorY },
        rotation: -angleRad - Math.PI/2,
        scale: 2,
      });
      bricks.push(
        bezierPolygonWithBricks(
          "compactIron",
          { outline: bladeOutline, spacing: 16, sampleStep: 6, alignToEdge: true },
          { level: baseLevel + 2 },
        ),
      );

      // --- 2. Grid lines: 1 brick thick, smallSquareYellow ---
      const lineHalf = BRICK_THICK / 2;
      for (let c = 0; c <= 4; c++) {
        const x = gridLeft + c * (CELL_W);
        bricks.push(
          polygonWithBricks(
            "smallSquareYellow",
            {
              vertices: createRectangle(x - lineHalf, gridTop, BRICK_THICK, GRID_H),
            },
            { level: SAND_LEVEL },
          ),
        );
      }
      for (let r = 0; r <= 3; r++) {
        const y = gridTop + r * CELL_H;
        bricks.push(
          polygonWithBricks(
            "smallSquareYellow",
            {
              vertices: createRectangle(gridLeft, y - lineHalf, GRID_W, BRICK_THICK),
            },
            { level: SAND_LEVEL },
          ),
        );
      }

      // --- 3. Edge cells: coal (perimeter cells) ---
      const edgeCells: [number, number][] = [];
      for (let c = 0; c < 4; c++) {
        edgeCells.push([c, 0]);
        edgeCells.push([c, 2]);
      }
      edgeCells.push([0, 1], [3, 1]);
      for (const [col, row] of edgeCells) {
        const c = cellInner(col, row);
        bricks.push(
          polygonWithBricks(
            "smallCoal",
            {
              vertices: createRectangle(c.left, c.top, c.width, c.height),
            },
            { level: COAL_LEVEL },
          ),
        );
      }

      return bricks;
    },
    enemies: ({ mapLevel }) => {
      const level = 2;
      const middleCells: [number, number][] = [[1, 1], [2, 1]];
      const positions: SceneVector2[] = [];
      for (const [col, row] of middleCells) {
        const c = cellInner(col, row);
        const cx = (c.left + c.right) / 2;
        const cy = (c.top + c.bottom) / 2;
        positions.push(
          { x: cx - 40, y: cy - 30 },
          { x: cx, y: cy + 20 },
          { x: cx + 45, y: cy - 25 },
        );
      }
      return positions.map((position) => ({
        type: "coalConvoyGuardian" as const,
        level,
        position,
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
        id: "coalConvoy",
        level: 1,
      },
    ],
    mapsRequired: { coalConvoy: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
