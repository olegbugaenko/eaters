import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierPolygonWithBricks,
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 2200, height: 1200 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 180, y: center.y + 220 };

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

  const createWheelArchHole = (
    centerX: number,
    bottomY: number,
    radius: number,
    segments = 14,
  ): SceneVector2[] => {
    const points: SceneVector2[] = [{ x: centerX - radius - 24, y: bottomY }];

    for (let i = 0; i <= segments; i += 1) {
      const angle = Math.PI - (Math.PI * i) / segments;
      points.push({
        x: centerX + Math.cos(angle) * radius,
        y: bottomY - Math.sin(angle) * radius,
      });
    }

    points.push({ x: centerX + radius + 24, y: bottomY });
    points.push({ x: centerX + radius + 24, y: bottomY + 46 });
    points.push({ x: centerX - radius - 24, y: bottomY + 46 });
    return points;
  };

  // Side-view sedan proportions inspired by simple public-domain sedan silhouettes.
  const carLeft = 320;
  const carRight = 1910;
  const bodyBottomY = 860;
  const bodyTopY = 690;
  const rearRoofX = 760;
  const frontRoofX = 1360;
  const roofPeakY = 360;
  const hoodNoseX = 1880;
  const hoodTopY = 520;
  const rearDeckY = 560;
  const wheelRadius = 138;
  const wheelY = 848;
  const rearWheelX = 760;
  const frontWheelX = 1520;

  const portalPositions: SceneVector2[] = [
    { x: 360, y: 250 },
    { x: 360, y: 1030 },
    { x: 1840, y: 250 },
    { x: 1840, y: 1030 },
  ];

  return {
    name: "Автомобіль",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 7, y: 3 },
    icon: "automobile.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const ironLevel = baseLevel + 4;
      const brickOpts = { level: ironLevel };

      const bodyShell = polygonWithBricks(
        "compactIron",
        {
          vertices: [
            { x: carLeft, y: bodyBottomY - 34 },
            { x: carLeft + 40, y: bodyTopY + 40 },
            { x: carLeft + 190, y: rearDeckY },
            { x: rearRoofX - 120, y: rearDeckY },
            { x: rearRoofX + 30, y: roofPeakY + 50 },
            { x: rearRoofX + 180, y: roofPeakY },
            { x: frontRoofX - 140, y: roofPeakY },
            { x: frontRoofX + 10, y: roofPeakY + 60 },
            { x: frontRoofX + 170, y: hoodTopY + 10 },
            { x: hoodNoseX - 70, y: hoodTopY },
            { x: hoodNoseX, y: bodyTopY + 40 },
            { x: hoodNoseX + 10, y: bodyBottomY - 46 },
            { x: hoodNoseX - 120, y: bodyBottomY },
            { x: carLeft + 120, y: bodyBottomY },
          ],
          holes: [
            [
              { x: rearRoofX + 30, y: roofPeakY + 52 },
              { x: rearRoofX + 155, y: roofPeakY + 20 },
              { x: frontRoofX - 180, y: roofPeakY + 20 },
              { x: frontRoofX - 20, y: roofPeakY + 92 },
              { x: frontRoofX - 50, y: hoodTopY + 10 },
              { x: rearRoofX + 90, y: rearDeckY - 18 },
            ],
            createWheelArchHole(rearWheelX, bodyBottomY - 6, wheelRadius),
            createWheelArchHole(frontWheelX, bodyBottomY - 6, wheelRadius),
          ],
        },
        brickOpts,
      );

      const roofSpine = bezierPolygonWithBricks(
        "compactIron",
        {
          outline: [
            {
              start: { x: rearRoofX - 30, y: rearDeckY + 4 },
              control1: { x: rearRoofX + 30, y: roofPeakY + 110 },
              control2: { x: rearRoofX + 150, y: roofPeakY + 12 },
              end: { x: rearRoofX + 250, y: roofPeakY },
            },
            {
              start: { x: rearRoofX + 250, y: roofPeakY },
              control1: { x: frontRoofX - 150, y: roofPeakY - 8 },
              control2: { x: frontRoofX - 70, y: roofPeakY + 18 },
              end: { x: frontRoofX + 10, y: roofPeakY + 60 },
            },
            {
              start: { x: frontRoofX + 10, y: roofPeakY + 60 },
              control1: { x: frontRoofX + 85, y: roofPeakY + 130 },
              control2: { x: frontRoofX + 120, y: hoodTopY + 34 },
              end: { x: frontRoofX + 150, y: hoodTopY + 10 },
            },
          ],
          spacing: 24,
          sampleStep: 8,
          alignToEdge: true,
        },
        brickOpts,
      );

      const hoodAccent = bezierPolygonWithBricks(
        "compactIron",
        {
          outline: [
            {
              start: { x: frontRoofX + 70, y: hoodTopY + 26 },
              control1: { x: frontRoofX + 300, y: hoodTopY - 8 },
              control2: { x: hoodNoseX - 250, y: hoodTopY - 8 },
              end: { x: hoodNoseX - 120, y: hoodTopY + 20 },
            },
            {
              start: { x: hoodNoseX - 120, y: hoodTopY + 20 },
              control1: { x: hoodNoseX - 240, y: hoodTopY + 58 },
              control2: { x: frontRoofX + 240, y: hoodTopY + 58 },
              end: { x: frontRoofX + 70, y: hoodTopY + 26 },
            },
          ],
          spacing: 22,
          sampleStep: 8,
          alignToEdge: true,
        },
        brickOpts,
      );

      const grille = polygonWithBricks(
        "compactIron",
        {
          vertices: createRectangle(hoodNoseX - 80, bodyTopY + 52, 74, 172),
        },
        brickOpts,
      );

      const rockerPanel = polygonWithBricks(
        "compactIron",
        {
          vertices: [
            { x: rearWheelX - 210, y: bodyBottomY - 28 },
            { x: frontWheelX + 210, y: bodyBottomY - 28 },
            { x: frontWheelX + 170, y: bodyBottomY + 20 },
            { x: rearWheelX - 170, y: bodyBottomY + 20 },
          ],
        },
        brickOpts,
      );

      const wheels = [
        circleWithBricks(
          "compactIron",
          { center: { x: rearWheelX, y: wheelY }, outerRadius: wheelRadius },
          brickOpts,
        ),
        circleWithBricks(
          "compactIron",
          { center: { x: frontWheelX, y: wheelY }, outerRadius: wheelRadius },
          brickOpts,
        ),
      ];

      return [bodyShell, roofSpine, hoodAccent, grille, rockerPanel, ...wheels];
    },
    enemies: ({ mapLevel }) => {
      const level = Math.max(1, Math.floor(mapLevel));
      return portalPositions.map((position) => ({
        type: "carGuardianPortalSpawnerEnemy" as const,
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
        id: "twinbladeAxe",
        level: 1,
      },
    ],
    mapsRequired: { twinbladeAxe: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
