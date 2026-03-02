import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { bezierPolygonWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import { generateTrapezoidOutline } from "../../../logic/services/brick-layout/outline-patterns";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 1500 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: center.x - 650, y: center.y };

  return {
    name: "Silver Chalice",
    size,
    icon: "silver_chalice.png",
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
        bottomWidth: 320,
        topWidth: 120,
        height: 140,
        convexity: {
          left: { control1: 20, control2: 15 },
          right: { control1: 20, control2: 15 },
          bottom: { control1: 25, control2: 25 },
        },
      });

      const stemOutline = generateTrapezoidOutline({
        bottomWidth: 80,
        topWidth: 80,
        height: 200,
        convexity: {
          left: { control1: 8, control2: 8 },
          right: { control1: 8, control2: 8 },
        },
      });

      const bowlOutline = generateTrapezoidOutline({
        bottomWidth: 100,
        topWidth: 580,
        height: 320,
        convexity: {
          left: { control1: 40, control2: 25 },
          right: { control1: 40, control2: 25 },
          top: { control1: 40, control2: 40 },
        },
      });

      const base = bezierPolygonWithBricks(
        "smallSilver",
        {
          outline: transformBezierOutline(baseOutline, {
            position: { x: center.x, y: center.y + 280 },
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
            position: { x: center.x, y: center.y + 80 },
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
            position: { x: center.x, y: center.y - 130 },
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
