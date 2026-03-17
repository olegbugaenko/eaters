import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { EnemySpawnData } from "../../../logic/modules/active-map/enemies/enemies.types";
import {
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1600, height: 2400 };
  const faceCenter: SceneVector2 = { x: size.width / 2, y: 700 };
  const spawnPoint: SceneVector2 = { x: 200, y: 1260 };

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

  const createCapsuleVertices = (
    centerX: number,
    topY: number,
    bottomY: number,
    radius: number,
    segments = 20,
  ): SceneVector2[] => {
    const topCenterY = topY + radius;
    const bottomCenterY = bottomY - radius;
    const points: SceneVector2[] = [];

    for (let i = 0; i <= segments; i += 1) {
      const angle = Math.PI + (Math.PI * i) / segments;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: topCenterY + Math.sin(angle) * radius,
      });
    }

    for (let i = 0; i <= segments; i += 1) {
      const angle = (Math.PI * i) / segments;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: bottomCenterY + Math.sin(angle) * radius,
      });
    }

    return points;
  };

  const createHandPolygon = (
    start: SceneVector2,
    end: SceneVector2,
    width: number,
  ): SceneVector2[] => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    return [
      { x: start.x + nx * width, y: start.y + ny * width },
      { x: end.x + nx * (width * 0.55), y: end.y + ny * (width * 0.55) },
      { x: end.x - nx * (width * 0.55), y: end.y - ny * (width * 0.55) },
      { x: start.x - nx * width, y: start.y - ny * width },
    ];
  };

  const dialRadius = 400;
  const dialTurretRadius = 305;
  const outerCaseRadius = 510;
  const lowerCaseTopY = 1080;
  const lowerCaseBottomY = 2290;
  const lowerCaseOuterRadius = 280;
  const lowerCaseInnerRadius = 190;
  const pendulumBobCenter: SceneVector2 = { x: faceCenter.x, y: 1940 };
  const pendulumBobRadius = 82;

  return {
    name: "Agressive Clock",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 3, y: 7 },
    unlockedBy: [
      {
        type: "map",
        id: "theWheel",
        level: 1,
      },
    ],
    icon: "agressive_clock.png",
    lockedForDemo: true,
    mapsRequired: { theWheel: 1 },
    maxLevel: 1,
    bricks: ({ mapLevel }) => {
      const woodLevel = Math.max(1, Math.floor(mapLevel)) + 4;
      const opts = { level: woodLevel };

      const faceOuterFrame = circleWithBricks(
        "smallWood",
        {
          center: faceCenter,
              innerRadius: dialRadius + 72,
          outerRadius: outerCaseRadius,
        },
        opts,
      );

      const faceInnerBezel = circleWithBricks(
        "smallWood",
        {
          center: faceCenter,
              innerRadius: dialRadius + 10,
              outerRadius: dialRadius + 54,
        },
        opts,
      );

      const lowerCase = polygonWithBricks(
        "smallWood",
        {
          vertices: createCapsuleVertices(
            faceCenter.x,
            lowerCaseTopY,
            lowerCaseBottomY,
            lowerCaseOuterRadius,
          ),
          holes: [
            createCapsuleVertices(
              faceCenter.x,
              lowerCaseTopY + 110,
              lowerCaseBottomY - 110,
              lowerCaseInnerRadius,
            ),
          ],
        },
        opts,
      );

      const leftRod = polygonWithBricks(
        "smallWood",
        {
          vertices: createRectangle(faceCenter.x - 92, 1180, 34, 630),
        },
        opts,
      );

      const rightRod = polygonWithBricks(
        "smallWood",
        {
          vertices: createRectangle(faceCenter.x + 58, 1180, 34, 630),
        },
        opts,
      );

      const pendulumBob = circleWithBricks(
        "smallWood",
        {
          center: pendulumBobCenter,
          innerRadius: 24,
          outerRadius: pendulumBobRadius,
        },
        opts,
      );

      const centerCap = circleWithBricks(
        "smallWood",
        {
          center: faceCenter,
          outerRadius: 36,
        },
        opts,
      );

      const hourHand = polygonWithBricks(
        "smallWood",
        {
          vertices: createHandPolygon(
            { x: faceCenter.x, y: faceCenter.y },
            { x: faceCenter.x - 170, y: faceCenter.y - 110 },
            26,
          ),
        },
        opts,
      );

      const minuteHand = polygonWithBricks(
        "smallWood",
        {
          vertices: createHandPolygon(
            { x: faceCenter.x, y: faceCenter.y },
            { x: faceCenter.x + 225, y: faceCenter.y - 165 },
            20,
          ),
        },
        opts,
      );

      return [
        faceOuterFrame,
        faceInnerBezel,
        lowerCase,
        leftRod,
        rightRod,
        pendulumBob,
        hourHand,
        minuteHand,
        centerCap,
      ];
    },
    enemies: () => {
      return Array.from({ length: 12 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI) / 6;
        return {
          type: index % 2 === 0 ? "freezeTurretEnemy" : "laserTurretEnemy",
          level: index % 2 === 0 ? 6 : 4,
          position: {
            x: faceCenter.x + Math.cos(angle) * dialTurretRadius,
            y: faceCenter.y + Math.sin(angle) * dialTurretRadius,
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
