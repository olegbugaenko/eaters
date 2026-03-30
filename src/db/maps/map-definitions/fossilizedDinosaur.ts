import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierCurveWithBricks,
  bezierPolygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { BezierCurveSegment } from "../../../logic/services/brick-layout/brick-layout.types";
import type { MapConfig } from "../maps-db.types";

/** Side-view theropod-ish skeleton; coords in map space (1600×1600). */
const mapConfig = (() => {
  const size: SceneSize = { width: 1800, height: 2000 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 90, y: size.height - 420 };

  const spacing = 13;
  const sampleStep = 8;

  // Closed skull + snout (left)
  const skullOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -190, y: 0 },
      control1: { x: -160, y: -30 },
      control2: { x: -100, y: -40 },
      end: { x: -50, y: -40 },
    },
    {
      start: { x: -50, y: -40 },
      control1: { x: -20, y: -50 },
      control2: { x: 10, y: -100 },
      end: { x: 40, y: -110 },
    },
    {
      start: { x: 40, y: -110 },
      control1: { x: 70, y: -100 },
      control2: { x: 100, y: -70 },
      end: { x: 150, y: -10 },
    },
    {
      start: { x: 150, y: -10 },
      control1: { x: 140, y: 20 },
      control2: { x: 110, y: 50 },
      end: { x: 50, y: 50 },
    },
    {
      start: { x: 50, y: 50 },
      control1: { x: 0, y: 30 },
      control2: { x: -80, y: 30 },
      end: { x: -190, y: 0 },
    },
  ];

  const bodyOutline: readonly BezierCurveSegment[] = [
    {
      start: { x: -300, y: 0 },
      control1: { x: -60, y: -20 },
      control2: { x: 60, y: -20 },
      end: { x: 300, y: 0 },
    },
    {
      start: { x: 300, y: 0 },
      control1: { x: 60, y: 40 },
      control2: { x: -60, y: 100 },
      end: { x: -90, y: 140 },
    },
    {
      start: { x: -90, y: 140 },
      control1: { x: -180, y: 110 },
      control2: { x: -270, y: 40 },
      end: { x: -300, y: 0 },
    },
  ];

  /** Hip = (0,0). Same polyline as the weight-bearing leg; rear leg = mirror X + slight rotate + hip shift toward tail. */
  const legMainLocal: readonly BezierCurveSegment[] = [
    {
      start: { x: 0, y: 0 },
      control1: { x: -100, y: 100 },
      control2: { x: -150, y: 200 },
      end: { x: -200, y: 300 },
    },
    {
      start: { x: -200, y: 300 },
      control1: { x: -150, y: 350 },
      control2: { x: -100, y: 400 },
      end: { x: -50, y: 450 },
    },
    {
      start: { x: -50, y: 450 },
      control1: { x: -60, y: 475 },
      control2: { x: -70, y: 500 },
      end: { x: -80, y: 525 },
    },
  ];

  const legToeALocal: readonly BezierCurveSegment[] = [
    {
      start: { x: -90, y: 530 },
      control1: { x: -130, y: 550 },
      control2: { x: -170, y: 580 },
      end: { x: -190, y: 620 },
    },
  ];

  const legToeBLocal: readonly BezierCurveSegment[] = [
    {
      start: { x: -100, y: 530 },
      control1: { x: -140, y: 520 },
      control2: { x: -180, y: 535 },
      end: { x: -210, y: 560 },
    },
  ];

  const LEG_HIP_FRONT: SceneVector2 = { x: 900, y: 800 };
  /** Toward tail (+x), slightly higher y = “floating” stride; same bend as front, only rotated back. */
  const LEG_HIP_REAR: SceneVector2 = { x: 910, y: 778 };
  const rearLegTransform = {
    position: LEG_HIP_REAR,
    rotation: -0.32,
  };

  const cornerEnemies: SceneVector2[] = [
    { x: 130, y: 130 },
    { x: size.width - 130, y: 130 },
    { x: size.width - 130, y: size.height - 330 },
    { x: 130, y: size.height/2 - 120 },
  ];

  return {
    name: "Fossilized Dinosaur",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 8 },
    icon: "fossilized_dinosaur.png",
    lockedForDemo: false,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const coalLevel = baseLevel + 3;
      const opts = { level: coalLevel };

      const coalBone = (
        outline: readonly BezierCurveSegment[],
        transform: { position: SceneVector2; rotation?: number; scale?: number | SceneVector2 },
        boneSpacing = spacing,
      ) =>
        bezierPolygonWithBricks(
          "smallCoal",
          {
            outline: transformBezierOutline(outline, transform),
            spacing: boneSpacing,
            sampleStep,
            alignToEdge: true,
          },
          opts,
        );

      return [
        coalBone(skullOutline, { position: { x: 215, y: 718 } }),
        bezierCurveWithBricks("smallCoal", {
          segments: [{
            start: { x: 350, y: 720 },
            control1: { x: 400, y: 780 },
            control2: { x: 750, y: 780 },
            end: { x: 900, y: 800 },
          }],
          spacing: spacing,
          sampleStep: sampleStep,
          thickness: 40,
        }, opts),
        // Rear leg: same contour as front — no mirror; rotate back toward tail + higher hip
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legMainLocal, rearLegTransform),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 30,
          },
          opts,
        ),
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legToeALocal, rearLegTransform),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legToeBLocal, rearLegTransform),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),
        // Front leg (weight-bearing) — same local spline, identity transform
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legMainLocal, { position: LEG_HIP_FRONT }),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 30,
          },
          opts,
        ),
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legToeALocal, { position: LEG_HIP_FRONT }),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: transformBezierOutline(legToeBLocal, { position: LEG_HIP_FRONT }),
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),

        // Forelimb — shoulder on upper thorax (below neck root, above belly), not hip height
        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: [
              {
                start: { x: 630, y: 780 },
                control1: { x: 620, y: 810 },
                control2: { x: 610, y: 840 },
                end: { x: 600, y: 870 },
              },
              {
                start: { x: 600, y: 870 },
                control1: { x: 550, y: 870 },
                control2: { x: 510, y: 880 },
                end: { x: 490, y: 890 },
              },
            ],
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 30,
          },
          opts,
        ),

        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: [{
              start: { x: 500, y: 890 },
              control1: { x: 480, y: 920 },
              control2: { x: 470, y: 950 },
              end: { x: 460, y: 980 },
            }],
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),

        bezierCurveWithBricks(
          "smallCoal",
          {
            segments: [{
              start: { x: 490, y: 880 },
              control1: { x: 460, y: 880 },
              control2: { x: 430, y: 905 },
              end: { x: 410, y: 920 },
            }],
            spacing: spacing,
            sampleStep: sampleStep,
            thickness: 20,
          },
          opts,
        ),

        // body
        coalBone(bodyOutline, { position: { x: 900, y: 800 } }),

        // tail
        bezierCurveWithBricks("smallCoal", {
          segments: [{
            start: { x: 900, y: 800 },
            control1: { x: 1000, y: 810 },
            control2: { x: 1150, y: 750 },
            end: { x: 1600, y: 800 },
          }],
          spacing: spacing,
          sampleStep: sampleStep,
          thickness: 30,
        }, opts),
      ];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return cornerEnemies.map((position) => ({
        type: "coalFlameGuardian" as const,
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
        id: "geologicalExcavations",
        level: 1,
      },
    ],
    mapsRequired: { geologicalExcavations: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
