import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierCurveWithBricks,
  bezierPolygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = {
    x: size.width / 2,
    y: (size.height - 80) / 2,
  };
  const spawnPoint: SceneVector2 = { x: center.x - 400, y: size.height - 420 };

  // Папороть — довгий загострений лист, асиметричний
  const baseFernOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -90, y: 0 },
      control1: { x: -60, y: -140 },
      control2: { x: 30, y: -200 },
      end: { x: 100, y: -40 },
    },
    {
      start: { x: 100, y: -40 },
      control1: { x: 40, y: 160 },
      control2: { x: -70, y: 180 },
      end: { x: -90, y: 0 },
    },
  ];

  // Тропічний лист — ширший, округліший, інша форма ніж bezierGrove
  const baseLeafOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -140, y: 20 },
      control1: { x: -100, y: -100 },
      control2: { x: 60, y: -140 },
      end: { x: 160, y: 0 },
    },
    {
      start: { x: 160, y: 0 },
      control1: { x: 80, y: 130 },
      control2: { x: -80, y: 100 },
      end: { x: -140, y: 20 },
    },
  ];

  // Ліани — криві Безьє
  const vineSegments: readonly { segments: readonly BezierCurveSegment[] }[] = [
    {
      segments: [
        {
          start: { x: center.x - 100, y: center.y + 400 },
          control1: { x: center.x - 200, y: center.y + 150 },
          control2: { x: center.x - 350, y: center.y - 100 },
          end: { x: center.x - 450, y: center.y - 280 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x + 80, y: center.y + 380 },
          control1: { x: center.x + 250, y: center.y + 120 },
          control2: { x: center.x + 400, y: center.y - 150 },
          end: { x: center.x + 520, y: center.y - 320 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x, y: center.y + 350 },
          control1: { x: center.x + 180, y: center.y + 80 },
          control2: { x: center.x + 220, y: center.y - 120 },
          end: { x: center.x + 180, y: center.y - 300 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x - 50, y: center.y + 320 },
          control1: { x: center.x - 280, y: center.y + 50 },
          control2: { x: center.x - 320, y: center.y - 200 },
          end: { x: center.x - 200, y: center.y - 350 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x + 200, y: center.y + 200 },
          control1: { x: center.x + 380, y: center.y + 80 },
          control2: { x: center.x + 450, y: center.y - 80 },
          end: { x: center.x + 380, y: center.y - 220 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x - 250, y: center.y + 180 },
          control1: { x: center.x - 420, y: center.y + 40 },
          control2: { x: center.x - 480, y: center.y - 120 },
          end: { x: center.x - 400, y: center.y - 250 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x - 300, y: center.y },
          control1: { x: center.x - 150, y: center.y - 180 },
          control2: { x: center.x + 50, y: center.y - 220 },
          end: { x: center.x + 200, y: center.y - 150 },
        },
      ],
    },
    {
      segments: [
        {
          start: { x: center.x + 280, y: center.y + 50 },
          control1: { x: center.x + 120, y: center.y - 160 },
          control2: { x: center.x - 80, y: center.y - 200 },
          end: { x: center.x - 220, y: center.y - 100 },
        },
      ],
    },
  ];

  // Травинки (як на snakeNest) — органичні плями
  const grassPatches: readonly { outline: readonly BezierCurveSegment[] }[] = [
    {
      outline: [
        {
          start: { x: center.x - 80, y: center.y },
          control1: { x: center.x - 120, y: center.y - 180 },
          control2: { x: center.x - 200, y: center.y - 260 },
          end: { x: center.x - 320, y: center.y - 260 },
        },
        {
          start: { x: center.x - 360, y: center.y - 260 },
          control1: { x: center.x - 280, y: center.y - 260 },
          control2: { x: center.x - 200, y: center.y - 180 },
          end: { x: center.x - 120, y: center.y },
        },
      ],
    },
    {
      outline: [
        {
          start: { x: center.x + 90, y: center.y + 80 },
          control1: { x: center.x + 130, y: center.y - 80 },
          control2: { x: center.x + 200, y: center.y - 180 },
          end: { x: center.x + 320, y: center.y - 180 },
        },
        {
          start: { x: center.x + 360, y: center.y - 180 },
          control1: { x: center.x + 280, y: center.y - 180 },
          control2: { x: center.x + 200, y: center.y - 80 },
          end: { x: center.x + 130, y: center.y + 80 },
        },
      ],
    },
    {
      outline: [
        {
          start: { x: center.x, y: center.y + 140 },
          control1: { x: center.x, y: center.y },
          control2: { x: center.x - 35, y: center.y - 90 },
          end: { x: center.x - 90, y: center.y - 130 },
        },
        {
          start: { x: center.x - 110, y: center.y - 130 },
          control1: { x: center.x - 70, y: center.y - 90 },
          control2: { x: center.x - 110, y: center.y },
          end: { x: center.x - 35, y: center.y + 140 },
        },
      ],
    },
  ];

  return {
    name: "Impenetrable Jungle",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 1, y: 7 },
    icon: "jungle.png",
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const woodLevel = baseLevel + 2;
      const organicLevel = baseLevel + 4;

      const bricks: ReturnType<typeof bezierPolygonWithBricks>[] = [];

      // Ліани
      vineSegments.forEach(({ segments }) => {
        bricks.push(
          bezierCurveWithBricks(
            "smallJungleVine",
            {
              segments,
              spacing: 24,
              rotationOffset: Math.PI / 2,
            },
            { level: woodLevel },
          ),
        );
      });

      // Папороті — багато листя з різними позиціями та обертаннями
      const fernPositions: { x: number; y: number; scale: number; rotation: number }[] = [
        { x: center.x - 380, y: center.y - 200, scale: 1.0, rotation: -2.8 },
        { x: center.x - 480, y: center.y - 80, scale: 0.85, rotation: -3.2 },
        { x: center.x - 420, y: center.y + 120, scale: 0.9, rotation: 2.5 },
        { x: center.x - 280, y: center.y + 220, scale: 0.95, rotation: 1.8 },
        { x: center.x - 120, y: center.y + 280, scale: 0.8, rotation: -1.2 },
        { x: center.x + 80, y: center.y + 260, scale: 0.9, rotation: 0.9 },
        { x: center.x + 220, y: center.y + 180, scale: 0.85, rotation: -0.5 },
        { x: center.x + 350, y: center.y + 60, scale: 1.0, rotation: 0.3 },
        { x: center.x + 450, y: center.y - 120, scale: 0.9, rotation: -0.8 },
        { x: center.x + 380, y: center.y - 260, scale: 0.85, rotation: 0.5 },
        { x: center.x + 180, y: center.y - 320, scale: 0.95, rotation: 1.2 },
        { x: center.x - 50, y: center.y - 300, scale: 0.9, rotation: -1.5 },
        { x: center.x - 220, y: center.y - 250, scale: 0.85, rotation: 2.1 },
        { x: center.x - 150, y: center.y - 80, scale: 0.75, rotation: -2.2 },
        { x: center.x + 100, y: center.y - 50, scale: 0.8, rotation: 1.5 },
        { x: center.x + 280, y: center.y + 20, scale: 0.7, rotation: -0.9 },
        { x: center.x - 320, y: center.y + 40, scale: 0.75, rotation: 2.8 },
        { x: center.x + 50, y: center.y + 120, scale: 0.85, rotation: -1.8 },
      ];

      fernPositions.forEach(({ x, y, scale, rotation }) => {
        bricks.push(
          bezierPolygonWithBricks(
            "smallJungleLeaf",
            {
              outline: transformBezierOutline(baseFernOutline, {
                position: { x, y },
                scale,
                rotation,
              }),
              spacing: 20,
              sampleStep: 14,
              alignToEdge: true,
            },
            { level: organicLevel },
          ),
        );
      });

      // Звичайні листя (як у bezierGrove)
      const leafPositions: { x: number; y: number; scale: number; rotation: number }[] = [
        { x: center.x - 550, y: center.y - 150, scale: 0.9, rotation: -3.0 },
        { x: center.x - 600, y: center.y + 80, scale: 0.85, rotation: 2.6 },
        { x: center.x + 550, y: center.y - 180, scale: 0.9, rotation: 0.4 },
        { x: center.x + 580, y: center.y + 100, scale: 0.85, rotation: -1.1 },
        { x: center.x - 100, y: center.y - 350, scale: 0.8, rotation: 1.0 },
        { x: center.x + 150, y: center.y - 380, scale: 0.85, rotation: -0.6 },
        { x: center.x - 350, y: center.y + 320, scale: 0.9, rotation: 2.2 },
        { x: center.x + 300, y: center.y + 350, scale: 0.8, rotation: -1.4 },
      ];

      leafPositions.forEach(({ x, y, scale, rotation }) => {
        bricks.push(
          bezierPolygonWithBricks(
            "smallJungleLeaf",
            {
              outline: transformBezierOutline(baseLeafOutline, {
                position: { x, y },
                scale,
                rotation,
              }),
              spacing: 20,
              sampleStep: 14,
              alignToEdge: true,
            },
            { level: organicLevel },
          ),
        );
      });

      // Травинки
      grassPatches.forEach(({ outline }) => {
        bricks.push(
          bezierPolygonWithBricks(
            "smallJungleLeaf",
            {
              outline,
              spacing: 36,
              sampleStep: 14,
              alignToEdge: true,
            },
            { level: organicLevel },
          ),
        );
      });

      return bricks;
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return [
        { type: "jungleSnakeEnemy" as const, level, position: { x: center.x - 300, y: center.y - 150 } },
        { type: "jungleSnakeEnemy" as const, level, position: { x: center.x + 320, y: center.y - 100 } },
        { type: "jungleSnakeEnemy" as const, level, position: { x: center.x + 100, y: center.y + 200 } },
        { type: "jungleSnakeEnemy" as const, level, position: { x: center.x - 150, y: center.y + 180 } },
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
        id: "snakeNest",
        level: 1,
      },
    ],
    mapsRequired: { snakeNest: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
