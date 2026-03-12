import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { bezierPolygonWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import { generateTrapezoidOutline } from "../../../logic/services/brick-layout/outline-patterns";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 2100, height: 2100 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 920, y: center.y };

  return {
    name: "Silver Chalice",
    size,
    icon: "silver_cup.png",
    spawnPoints: [spawnPoint],
    nodePosition: { x: 6, y: 0 },
    lockedForDemo: false,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const silverLevel = baseLevel + 3;
      const opts = { level: silverLevel };
      const spacing = 24;
      const sampleStep = 12;

      const baseOutline = generateTrapezoidOutline({
        bottomWidth: 450,
        topWidth: 170,
        height: 200,
        convexity: {
          left: { control1: 28, control2: 21 },
          right: { control1: 28, control2: 21 },
          bottom: { control1: 35, control2: 35 },
        },
      });

      const stemOutline = generateTrapezoidOutline({
        bottomWidth: 113,
        topWidth: 113,
        height: 283,
        convexity: {
          left: { control1: 11, control2: 11 },
          right: { control1: 11, control2: 11 },
        },
      });

      const bowlOutline = generateTrapezoidOutline({
        bottomWidth: 141,
        topWidth: 820,
        height: 452,
        convexity: {
          left: { control1: 57, control2: 35 },
          right: { control1: 57, control2: 35 },
          top: { control1: 57, control2: 57 },
        },
      });

      const base = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(baseOutline, {
            position: { x: center.x, y: center.y + 396 },
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const stem = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(stemOutline, {
            position: { x: center.x, y: center.y + 113 },
          }),
          spacing,
          sampleStep,
          alignToEdge: true,
        },
        opts,
      );

      const bowl = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(bowlOutline, {
            position: { x: center.x, y: center.y - 184 },
          }),
          spacing: spacing * 0.8,
          sampleStep: sampleStep * 0.7,
          alignToEdge: true,
        },
        opts,
      );

      return [base, stem, bowl];
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
        id: "portalRing",
        level: 1,
      },
    ],
    mapsRequired: { portalRing: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
