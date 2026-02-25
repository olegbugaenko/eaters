import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  bezierPolygonWithBricks,
  circleWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import { transformBezierOutline } from "../../../logic/services/brick-layout/brick-layout.helpers";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1900, height: 1900 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = {
    x: center.x,
    y: center.y + 180,
  };

  const wheelRadius = 700;
  const brickSize = 24;
  const rimThickness = brickSize * 3;
  const hubRadius = 150;
  const hubThickness = brickSize * 2;
  const innerRadius = wheelRadius - rimThickness;
  const hubInnerRadius = hubRadius - hubThickness;
  const spokesCount = 8;
  const turretRadius = 430;

  const spokeOutline = [
    {
      start: { x: 150, y: -26 },
      control1: { x: 230, y: -80 },
      control2: { x: 420, y: -95 },
      end: { x: 650, y: -45 },
    },
    {
      start: { x: 650, y: -45 },
      control1: { x: 680, y: -20 },
      control2: { x: 680, y: 20 },
      end: { x: 650, y: 45 },
    },
    {
      start: { x: 650, y: 45 },
      control1: { x: 420, y: 95 },
      control2: { x: 200, y: 80 },
      end: { x: 150, y: 26 },
    },
    {
      start: { x: 150, y: 26 },
      control1: { x: 130, y: 12 },
      control2: { x: 130, y: -12 },
      end: { x: 150, y: -26 },
    },
  ] as const;

  return {
    name: "The Wheel",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 3, y: 6 },
    unlockedBy: [
      {
        type: "map",
        id: "deadOak",
        level: 1,
      },
    ],
    mapsRequired: { deadOak: 1 },
    maxLevel: 1,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const woodLevel = baseLevel + 2;

      const rim = circleWithBricks(
        "smallWood",
        {
          center,
          innerRadius,
          outerRadius: wheelRadius,
        },
        { level: woodLevel },
      );

      const hub = circleWithBricks(
        "smallWood",
        {
          center,
          innerRadius: hubInnerRadius,
          outerRadius: hubRadius,
        },
        { level: woodLevel },
      );

      const spokes = Array.from({ length: spokesCount }, (_, index) => {
        const angle = (index / spokesCount) * Math.PI * 2;

        return bezierPolygonWithBricks(
          "smallWood",
          {
            outline: transformBezierOutline(spokeOutline, {
              position: center,
              rotation: angle,
            }),
            spacing: 24,
            sampleStep: 12,
            alignToEdge: true,
          },
          { level: woodLevel },
        );
      });

      return [rim, hub, ...spokes];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));

      return Array.from({ length: spokesCount }, (_, index) => {
        const angle = ((index + 0.5) / spokesCount) * Math.PI * 2;
        return {
          type: "wheelVolleyTurretEnemy",
          level,
          position: {
            x: center.x + Math.cos(angle) * turretRadius,
            y: center.y + Math.sin(angle) * turretRadius,
          },
        } satisfies EnemySpawnData;
      });
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
  } satisfies MapConfig;
})();

export default mapConfig;
