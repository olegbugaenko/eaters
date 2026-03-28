import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierPolygonWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import { generateTrapezoidOutline } from "../../../logic/services/brick-layout/outline-patterns";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 2000, height: 2000 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };
  const halfSize = size.width / 2;
  const cornerOffset = 150;
  const cornerInset = halfSize - cornerOffset;
  const portalPositions: SceneVector2[] = [
    { x: cornerOffset, y: cornerOffset },
    { x: size.width - cornerOffset, y: cornerOffset },
    { x: size.width - cornerOffset, y: size.height-cornerOffset },
    { x: cornerOffset, y: size.height-cornerOffset },
  ];

  // Helmet: dome
  const helmetOutline = [
    {
      start: { x: -100, y: -120 },
      control1: { x: -140, y: -240 },
      control2: { x: 0, y: -320 },
      end: { x: 140, y: -240 },
    },
    {
      start: { x: 140, y: -240 },
      control1: { x: 100, y: -160 },
      control2: { x: 0, y: -120 },
      end: { x: -100, y: -120 },
    },
  ] as const;

  return {
    name: "Monument to the Unknown Knight",
    size,
    icon: "knight_monument.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 1 },
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const copperLevel = baseLevel + 3;
      const opts = { level: copperLevel };
      const spacing = 24;
      const sampleStep = 12;

      // Pedestal (640×200)
      const pedestal = polygonWithBricks(
        "smallCopper",
        {
          vertices: [
            { x: center.x - 620, y: center.y + 750 },
            { x: center.x + 620, y: center.y + 750 },
            { x: center.x + 620, y: center.y + 950 },
            { x: center.x - 620, y: center.y + 950 },
          ],
        },
        opts,
      );

      const sableLeftOutline = generateTrapezoidOutline({
        bottomWidth: 40,
        topWidth: 30,
        height: 900,
        convexity: {
          left: { control1: -95, control2: -160 },
          right: { control1: 165, control2: 290 },
          top: { control1: 45, control2: 45 },
        },
      });


      const chestOutline = generateTrapezoidOutline({
        bottomWidth: 160,
        topWidth: 280,
        height: 300,
        convexity: {
          left: { control1: 25, control2: 20 },
          right: { control1: 25, control2: 20 },
          top: { control1: 45, control2: 45 },
        },
      });

      const shoulderOutline = generateTrapezoidOutline({
        bottomWidth: 180,
        topWidth: 300,
        height: 200,
        convexity: {
          left: { control1: -25, control2: 20 },
          right: { control1: -25, control2: 20 },
          top: { control1: 45, control2: 45 },
        },
      });

      const topArmOutline = generateTrapezoidOutline({
        bottomWidth: 160,
        topWidth: 160,
        height: 360,
        convexity: {
          left: { control1: 25, control2: 20 },
          right: { control1: 25, control2: 20 },
        },
      });

      const bottomArmOutline = generateTrapezoidOutline({
        bottomWidth: 100,
        topWidth: 100,
        height: 360,
        convexity: {
          left: { control1: 25, control2: 20 },
          right: { control1: 25, control2: 20 },
        },
      });

      const headOutline = generateTrapezoidOutline({
        bottomWidth: 160,
        topWidth: 120,
        height: 200,
        convexity: {
          left: { control1: 25, control2: 20 },
          right: { control1: 25, control2: 20 },
          top: { control1: 25, control2: 20 },
        },
      });

      const chest = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(chestOutline, {
            position: { x: center.x, y: center.y + 300 },
            scale: { x: 2.4, y: 2.4 },
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const shoulderLeft = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(shoulderOutline, {
            position: { x: center.x - 300, y: center.y },
            scale: { x: 1.4, y: 1.4 },
            rotation: -1.57 + 0.2,
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const shoulderRight = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(shoulderOutline, {
            position: { x: center.x + 300, y: center.y },
            scale: { x: -1.4, y: 1.4 },
            rotation: 1.57 - 0.2,
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const topLeftArm = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(topArmOutline, {
            position: { x: center.x - 520, y: center.y + 200 },
            rotation: 0.4,
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const topRightArm = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(topArmOutline, {
            position: { x: center.x + 520, y: center.y + 200 },
            scale: { x: -1, y: 1 },
            rotation: -0.4,
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );


      const bottomLeftArm = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(bottomArmOutline, {
            position: { x: center.x - 420, y: center.y + 380 },
            rotation: -1.2,
          }),
          spacing: spacing * 0.9,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const bottomRightArm = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(bottomArmOutline, {
            position: { x: center.x + 420, y: center.y + 380 },
            scale: { x: -1, y: 1 },
            rotation: 1.2,
          }),
          spacing: spacing * 0.9,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const sableLeft = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(sableLeftOutline, {
            position: { x: center.x - 20, y: center.y },
            rotation: 0.6,
          }),
          spacing: spacing * 0.9,
          sampleStep: sampleStep * 0.8,
          alignToEdge: true,
        },
        opts,
      );

      const sableRight = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(sableLeftOutline, {
            position: { x: center.x + 20, y: center.y },
            scale: { x: -1, y: 1 },
            rotation: -0.6,
          }),
          spacing: spacing * 0.9,
          sampleStep: sampleStep * 0.8,
          alignToEdge: true,
        },
        opts,
      );
      const head = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(headOutline, {
            position: { x: center.x, y: center.y - 350 },
            scale: { x: 1.6, y: 1.6 },
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      // Helmet
      const helmet = bezierPolygonWithBricks(
        "smallCopper",
        {
          outline: transformBezierOutline(helmetOutline, {
            position: { x: center.x, y: center.y - 400 },
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      return [
        pedestal,
        chest,
        shoulderLeft,
        shoulderRight,
        topLeftArm,
        topRightArm,
        bottomLeftArm,
        bottomRightArm,
        head,
        helmet,
        sableLeft,
        sableRight,
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return portalPositions.map((position) => ({
        type: "bronzeArcherPortalSpawnerEnemy",
        level,
        position: { ...position },
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
        id: "coil",
        level: 1,
      },
    ],
    mapsRequired: { coil: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
