import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierCurveWithBricks,
  bezierPolygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = {
    x: size.width / 2,
    y: (size.height - 120) / 2,
  };
  const spawnPoint: SceneVector2 = { x: center.x - 380, y: size.height - 460 };

  const vineSegmentsRight = [
    {
      start: { x: center.x, y: center.y + 320 },
      control1: { x: center.x - 60, y: center.y + 80 },
      control2: { x: center.x + 280, y: center.y - 40 },
      end: { x: center.x + 420, y: center.y - 140 },
    },
    {
      start: { x: center.x + 420, y: center.y - 120 },
      control1: { x: center.x + 540, y: center.y - 180 },
      control2: { x: center.x + 600, y: center.y - 300 },
      end: { x: center.x + 680, y: center.y - 360 },
    },
  ] as const;

  const vineSegmentsLeft = [
    {
      start: { x: center.x, y: center.y + 320 },
      control1: { x: center.x + 60, y: center.y + 80 },
      control2: { x: center.x - 280, y: center.y - 40 },
      end: { x: center.x - 420, y: center.y - 110 },
    },
    {
      start: { x: center.x - 420, y: center.y - 110 },
      control1: { x: center.x - 540, y: center.y - 200 },
      control2: { x: center.x - 600, y: center.y - 270 },
      end: { x: center.x - 680, y: center.y - 320 },
    },
  ] as const;

  const vineSegmentsLeftCenter = [
    {
      start: { x: center.x, y: center.y + 320 },
      control1: { x: center.x + 160, y: center.y + 80 },
      control2: { x: center.x + 280, y: center.y - 40 },
      end: { x: center.x + 120, y: center.y - 110 },
    },
    {
      start: { x: center.x + 120, y: center.y - 110 },
      control1: { x: center.x + 40, y: center.y - 200 },
      control2: { x: center.x - 60, y: center.y - 270 },
      end: { x: center.x + 80, y: center.y - 320 },
    },
  ] as const;

  const baseLeafOutline = [
    {
      start: { x: -120, y: 0 },
      control1: { x: -80, y: -80 },
      control2: { x: 20, y: -120 },
      end: { x: 120, y: 0 },
    },
    {
      start: { x: 120, y: 0 },
      control1: { x: 20, y: 120 },
      control2: { x: -80, y: 80 },
      end: { x: -120, y: 0 },
    },
  ] as const;

  const leafOutlineLeft = transformBezierOutline(baseLeafOutline, {
    position: { x: center.x - 240, y: center.y + 140 },
    scale: 0.9,
    rotation: -Math.PI / 12,
  });

  const leafOutlineMid = transformBezierOutline(baseLeafOutline, {
    position: { x: center.x + 40, y: center.y + 220 },
    scale: 0.7,
    rotation: Math.PI / 9,
  });

  const leafOutlineRight = transformBezierOutline(baseLeafOutline, {
    position: { x: center.x + 260, y: center.y - 40 },
    scale: 1.1,
    rotation: (5 * Math.PI) / 18,
  });

  return {
    name: "Dangerous Bushes",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 1, y: 5 },
    icon: "dangerous_bushes.png",
    lockedForDemo: false,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const woodLevel = baseLevel + 2;
      const organicLevel = baseLevel + 3;

      const mainVineRight = bezierCurveWithBricks(
        "smallWood",
        {
          segments: vineSegmentsRight,
          spacing: 26,
          rotationOffset: Math.PI / 2,
        },
        { level: woodLevel },
      );

      const mainVineLeft = bezierCurveWithBricks(
        "smallWood",
        {
          segments: vineSegmentsLeft,
          spacing: 26,
          rotationOffset: Math.PI / 2,
        },
        { level: woodLevel },
      );

      const mainVineLeftCenter = bezierCurveWithBricks(
        "smallWood",
        {
          segments: vineSegmentsLeftCenter,
          spacing: 26,
          rotationOffset: Math.PI / 2,
        },
        { level: woodLevel },
      );

      const leafLeft = bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: leafOutlineLeft,
          spacing: 26,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: organicLevel },
      );

      const leafMid = bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: leafOutlineMid,
          spacing: 24,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: organicLevel },
      );

      const leafRight = bezierPolygonWithBricks(
        "smallOrganic",
        {
          outline: leafOutlineRight,
          spacing: 28,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: organicLevel },
      );

      return [
        mainVineRight,
        mainVineLeft,
        mainVineLeftCenter,
        // left wine
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 120, y: center.y + 250 },
              scale: 0.9,
              rotation: -2.95,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 240, y: center.y + 100 },
              scale: 0.9,
              rotation: -3.25,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 390, y: center.y + 10 },
              scale: 0.9,
              rotation: -3.75,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 530, y: center.y - 50 },
              scale: 0.9,
              rotation: -3.75,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 620, y: center.y - 270 },
              scale: 0.9,
              rotation: -2.55,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 390, y: center.y - 240 },
              scale: 0.9,
              rotation: -1.15,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 250, y: center.y - 160 },
              scale: 0.9,
              rotation: -1.35,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 100, y: center.y - 50 },
              scale: 0.9,
              rotation: -1.35,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 20, y: center.y + 90 },
              scale: 0.9,
              rotation: -1.25,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        // medium wine
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 240, y: center.y + 100 },
              scale: 0.9,
              rotation: -0.15,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 310, y: center.y - 20 },
              scale: 0.9,
              rotation: -0.15,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 240, y: center.y - 160 },
              scale: 0.9,
              rotation: -0.95,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 140, y: center.y - 270 },
              scale: 0.9,
              rotation: -0.85,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 150, y: center.y - 380 },
              scale: 0.9,
              rotation: -0.45,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 10, y: center.y - 380 },
              scale: 0.9,
              rotation: -2.05,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x - 70, y: center.y - 280 },
              scale: 0.9,
              rotation: -2.75,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 10, y: center.y - 140 },
              scale: 0.9,
              rotation: -3.05,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        // left wine
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 110, y: center.y + 190 },
              scale: 0.9,
              rotation: -0.35,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 510, y: center.y - 50 },
              scale: 0.9,
              rotation: 0.55,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 620, y: center.y - 130 },
              scale: 0.9,
              rotation: 0.55,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 640, y: center.y - 310 },
              scale: 0.9,
              rotation: -1.05,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 520, y: center.y - 310 },
              scale: 0.9,
              rotation: -1.75,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        bezierPolygonWithBricks(
          "smallOrganic",
          {
            outline: transformBezierOutline(baseLeafOutline, {
              position: { x: center.x + 410, y: center.y - 220 },
              scale: 0.9,
              rotation: -1.75,
            }),
            spacing: 22,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: organicLevel },
        ),
        leafLeft,
        leafMid,
        leafRight,
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
        id: "stoneCottage",
        level: 1,
      },
    ],
    mapsRequired: { stoneCottage: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
