import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierCurveWithBricks,
  bezierPolygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1400, height: 1200 };
  const centerX = size.width / 2;
  const groundY = size.height - 180;
  const spawnPoint: SceneVector2 = { x: 140, y: 140 };

  return {
    name: "Dead Oak",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 3, y: 5 },
    icon: "dead_oak.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const woodLevel = baseLevel + 1;
      const trunkTopY = groundY - 520;
      const trunkWidthBase = 170;
      const trunkWidthTop = 90;

      const trunkOutline = [
        {
          start: { x: centerX - trunkWidthBase / 2, y: groundY },
          control1: { x: centerX - trunkWidthBase / 2 - 20, y: groundY - 140 },
          control2: { x: centerX - trunkWidthTop / 2 - 30, y: trunkTopY + 160 },
          end: { x: centerX - trunkWidthTop / 2, y: trunkTopY },
        },
        {
          start: { x: centerX - trunkWidthTop / 2, y: trunkTopY },
          control1: { x: centerX - trunkWidthTop / 4, y: trunkTopY - 20 },
          control2: { x: centerX + trunkWidthTop / 4, y: trunkTopY - 20 },
          end: { x: centerX + trunkWidthTop / 2, y: trunkTopY },
        },
        {
          start: { x: centerX + trunkWidthTop / 2, y: trunkTopY },
          control1: { x: centerX + trunkWidthTop / 2 + 30, y: trunkTopY + 160 },
          control2: { x: centerX + trunkWidthBase / 2 + 20, y: groundY - 140 },
          end: { x: centerX + trunkWidthBase / 2, y: groundY },
        },
        {
          start: { x: centerX + trunkWidthBase / 2, y: groundY },
          control1: { x: centerX + trunkWidthBase / 4, y: groundY + 20 },
          control2: { x: centerX - trunkWidthBase / 4, y: groundY + 20 },
          end: { x: centerX - trunkWidthBase / 2, y: groundY },
        },
      ] as const;

      const trunk = bezierPolygonWithBricks(
        "smallWood",
        {
          outline: trunkOutline,
          spacing: 28,
          sampleStep: 14,
          alignToEdge: true,
        },
        { level: woodLevel },
      );

      const leftMainSegments = [
        {
          start: { x: centerX - 40, y: trunkTopY + 240 },
          control1: { x: centerX - 160, y: trunkTopY + 160 },
          control2: { x: centerX - 300, y: trunkTopY + 100 },
          end: { x: centerX - 360, y: trunkTopY + 80 },
        },
      ] as const;

      const rightMainSegments = [
        {
          start: { x: centerX + 40, y: trunkTopY + 240 },
          control1: { x: centerX + 160, y: trunkTopY + 160 },
          control2: { x: centerX + 300, y: trunkTopY + 100 },
          end: { x: centerX + 360, y: trunkTopY + 80 },
        },
      ] as const;

      const leftMainBottomSegments = [
        {
          start: { x: centerX - 360, y: trunkTopY + 90 },
          control1: { x: centerX - 410, y: trunkTopY + 90 },
          control2: { x: centerX - 490, y: trunkTopY + 130 },
          end: { x: centerX - 610, y: trunkTopY + 150 },
        },
      ] as const;

      const rightMainBottomSegments = [
        {
          start: { x: centerX + 360, y: trunkTopY + 90 },
          control1: { x: centerX + 410, y: trunkTopY + 90 },
          control2: { x: centerX + 490, y: trunkTopY + 130 },
          end: { x: centerX + 610, y: trunkTopY + 150 },
        },
      ] as const;

      const leftMainTopSegments = [
        {
          start: { x: centerX - 360, y: trunkTopY + 70 },
          control1: { x: centerX - 410, y: trunkTopY + 40 },
          control2: { x: centerX - 490, y: trunkTopY + 40 },
          end: { x: centerX - 610, y: trunkTopY - 50 },
        },
      ] as const;

      const rightMainTopSegments = [
        {
          start: { x: centerX + 360, y: trunkTopY + 70 },
          control1: { x: centerX + 410, y: trunkTopY + 40 },
          control2: { x: centerX + 490, y: trunkTopY + 40 },
          end: { x: centerX + 610, y: trunkTopY - 50 },
        },
      ] as const;

      const leftUpperBranchSegments = [
        {
          start: { x: centerX - 10, y: trunkTopY - 10 },
          control1: { x: centerX - 210, y: trunkTopY - 140 },
          control2: { x: centerX - 390, y: trunkTopY - 170 },
          end: { x: centerX - 550, y: trunkTopY - 200 },
        },
      ] as const;

      const rightUpperBranchSegments = [
        {
          start: { x: centerX + 10, y: trunkTopY - 10 },
          control1: { x: centerX + 210, y: trunkTopY - 140 },
          control2: { x: centerX + 390, y: trunkTopY - 170 },
          end: { x: centerX + 550, y: trunkTopY - 200 },
        },
      ] as const;

      const leftMainBranch = bezierCurveWithBricks(
        "smallWood",
        {
          segments: leftMainSegments,
          spacing: 26,
          thickness: 60,
        },
        { level: woodLevel },
      );

      const rightMainBranch = bezierCurveWithBricks(
        "smallWood",
        {
          segments: rightMainSegments,
          spacing: 26,
          thickness: 60,
        },
        { level: woodLevel },
      );

      const leftMainBranchBottom = bezierCurveWithBricks(
        "smallWood",
        {
          segments: leftMainBottomSegments,
          spacing: 26,
          thickness: 40,
        },
        { level: woodLevel },
      );

      const rightMainBranchBottom = bezierCurveWithBricks(
        "smallWood",
        {
          segments: rightMainBottomSegments,
          spacing: 26,
          thickness: 40,
        },
        { level: woodLevel },
      );

      const leftMainBranchTop = bezierCurveWithBricks(
        "smallWood",
        {
          segments: leftMainTopSegments,
          spacing: 26,
          thickness: 40,
        },
        { level: woodLevel },
      );
      const rightMainBranchTop = bezierCurveWithBricks(
        "smallWood",
        {
          segments: rightMainTopSegments,
          spacing: 26,
          thickness: 40,
        },
        { level: woodLevel },
      );

      const leftUpperBranch = bezierCurveWithBricks(
        "smallWood",
        {
          segments: leftUpperBranchSegments,
          spacing: 26,
          thickness: 30,
        },
        { level: woodLevel },
      );

      const rightUpperBranch = bezierCurveWithBricks(
        "smallWood",
        {
          segments: rightUpperBranchSegments,
          spacing: 26,
          thickness: 30,
        },
        { level: woodLevel },
      );

      const rootsOutline = [
        {
          start: { x: centerX - 180, y: groundY },
          control1: { x: centerX - 160, y: groundY + 40 },
          control2: { x: centerX - 60, y: groundY + 60 },
          end: { x: centerX, y: groundY + 50 },
        },
        {
          start: { x: centerX, y: groundY + 50 },
          control1: { x: centerX + 60, y: groundY + 60 },
          control2: { x: centerX + 160, y: groundY + 40 },
          end: { x: centerX + 180, y: groundY },
        },
        {
          start: { x: centerX + 180, y: groundY },
          control1: { x: centerX + 140, y: groundY - 10 },
          control2: { x: centerX + 80, y: groundY - 10 },
          end: { x: centerX, y: groundY - 10 },
        },
        {
          start: { x: centerX, y: groundY - 10 },
          control1: { x: centerX - 80, y: groundY - 10 },
          control2: { x: centerX - 140, y: groundY - 10 },
          end: { x: centerX - 180, y: groundY },
        },
      ] as const;

      const roots = bezierPolygonWithBricks(
        "smallWood",
        {
          outline: rootsOutline,
          spacing: 26,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: woodLevel },
      );

      return [
        trunk,
        leftMainBranch,
        rightMainBranch,
        leftMainBranchBottom,
        rightMainBranchBottom,
        leftMainBranchTop,
        rightMainBranchTop,
        leftUpperBranch,
        rightUpperBranch,
        roots,
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX - 10, y: trunkTopY - 10 },
                control1: { x: centerX - 30, y: trunkTopY - 70 },
                control2: { x: centerX - 50, y: trunkTopY - 110 },
                end: { x: centerX - 50, y: trunkTopY - 140 },
              },
              {
                start: { x: centerX - 50, y: trunkTopY - 140 },
                control1: { x: centerX - 90, y: trunkTopY - 160 },
                control2: { x: centerX - 150, y: trunkTopY - 190 },
                end: { x: centerX - 210, y: trunkTopY - 230 },
              },
              {
                start: { x: centerX - 210, y: trunkTopY - 230 },
                control1: { x: centerX - 250, y: trunkTopY - 250 },
                control2: { x: centerX - 280, y: trunkTopY - 280 },
                end: { x: centerX - 310, y: trunkTopY - 360 },
              },
            ],
            spacing: 26,
            thickness: 28,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX + 10, y: trunkTopY - 10 },
                control1: { x: centerX + 30, y: trunkTopY - 70 },
                control2: { x: centerX + 50, y: trunkTopY - 110 },
                end: { x: centerX + 50, y: trunkTopY - 140 },
              },
              {
                start: { x: centerX + 50, y: trunkTopY - 140 },
                control1: { x: centerX + 90, y: trunkTopY - 160 },
                control2: { x: centerX + 150, y: trunkTopY - 190 },
                end: { x: centerX + 210, y: trunkTopY - 230 },
              },
              {
                start: { x: centerX + 210, y: trunkTopY - 230 },
                control1: { x: centerX + 250, y: trunkTopY - 250 },
                control2: { x: centerX + 280, y: trunkTopY - 280 },
                end: { x: centerX + 310, y: trunkTopY - 360 },
              },
            ],
            spacing: 26,
            thickness: 28,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX - 50, y: trunkTopY - 140 },
                control1: { x: centerX - 60, y: trunkTopY - 210 },
                control2: { x: centerX - 120, y: trunkTopY - 240 },
                end: { x: centerX - 130, y: trunkTopY - 390 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX + 50, y: trunkTopY - 140 },
                control1: { x: centerX + 60, y: trunkTopY - 210 },
                control2: { x: centerX + 120, y: trunkTopY - 240 },
                end: { x: centerX + 130, y: trunkTopY - 390 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX + 50, y: trunkTopY - 140 },
                control1: { x: centerX + 10, y: trunkTopY - 210 },
                control2: { x: centerX - 30, y: trunkTopY - 240 },
                end: { x: centerX - 10, y: trunkTopY - 390 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX + 150, y: trunkTopY + 210 },
                control1: { x: centerX + 190, y: trunkTopY + 240 },
                control2: { x: centerX + 320, y: trunkTopY + 270 },
                end: { x: centerX + 430, y: trunkTopY + 300 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX - 150, y: trunkTopY + 210 },
                control1: { x: centerX - 190, y: trunkTopY + 240 },
                control2: { x: centerX - 320, y: trunkTopY + 270 },
                end: { x: centerX - 430, y: trunkTopY + 300 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX + 150, y: trunkTopY - 70 },
                control1: { x: centerX + 250, y: trunkTopY - 90 },
                control2: { x: centerX + 320, y: trunkTopY - 60 },
                end: { x: centerX + 460, y: trunkTopY - 80 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
        ),
        bezierCurveWithBricks(
          "smallWood",
          {
            segments: [
              {
                start: { x: centerX - 150, y: trunkTopY - 70 },
                control1: { x: centerX - 250, y: trunkTopY - 90 },
                control2: { x: centerX - 320, y: trunkTopY - 60 },
                end: { x: centerX - 460, y: trunkTopY - 80 },
              },
            ],
            spacing: 26,
            thickness: 20,
          },
          { level: woodLevel },
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
        id: "spruce",
        level: 1,
      },
    ],
    mapsRequired: { spruce: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
