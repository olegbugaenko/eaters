import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  bezierPolygonWithBricks,
  circleWithBricks,
  polygonWithBricks,
} from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const size: SceneSize = { width: 1500, height: 900 };
  const center: SceneVector2 = { x: size.width / 2, y: size.height / 2 };
  const spawnPoint: SceneVector2 = { x: 100, y: 100 };

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

  return {
    name: "Coal Convoy",
    size,
    spawnPoints: [spawnPoint],
    nodePosition: { x: 5, y: 6 },
    icon: "mine.png",
    lockedForDemo: true,
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));
      const ironLevel = baseLevel + 1;

      const wagonStartX = 100;
      const wagonEndX = center.x + 150;
      const wagonWidth = wagonEndX - wagonStartX;
      const wagonTopY = center.y - 70;
      const wagonBottomY = center.y + 70;
      const wagonHeight = wagonBottomY - wagonTopY;
      const frameThickness = 30;

      const coalBaseY = wagonBottomY - frameThickness;
      const coalPeakY = wagonTopY - 190;
      const coalPeakX = wagonStartX + wagonWidth * 0.62;

      const coalOutline = [
        {
          start: { x: wagonStartX, y: coalBaseY },
          control1: { x: wagonStartX + wagonWidth * 0.33, y: coalBaseY },
          control2: { x: wagonStartX + wagonWidth * 0.66, y: coalBaseY },
          end: { x: wagonEndX, y: coalBaseY },
        },
        {
          start: { x: wagonEndX, y: coalBaseY },
          control1: { x: wagonEndX + 40, y: coalBaseY - 80 },
          control2: { x: coalPeakX + 120, y: coalPeakY + 40 },
          end: { x: coalPeakX, y: coalPeakY },
        },
        {
          start: { x: coalPeakX, y: coalPeakY },
          control1: { x: coalPeakX - 180, y: coalPeakY + 30 },
          control2: { x: wagonStartX - 40, y: coalBaseY - 70 },
          end: { x: wagonStartX, y: coalBaseY },
        },
      ] as const;

      const coalPile = bezierPolygonWithBricks(
        "smallCoal",
        {
          outline: coalOutline,
          spacing: 24,
          sampleStep: 12,
          alignToEdge: true,
        },
        { level: baseLevel + 1 },
      );

      const wagonFrame = polygonWithBricks(
        "smallIron",
        {
          vertices: createRectangle(
            wagonStartX,
            wagonTopY,
            wagonWidth,
            wagonHeight,
          ),
          holes: [
            createRectangle(
              wagonStartX + frameThickness,
              wagonTopY + frameThickness,
              wagonWidth - frameThickness * 2,
              wagonHeight - frameThickness * 2,
            ),
          ],
        },
        { level: ironLevel },
      );

      const wagonGridBars = [1, 2, 3].map((index) => {
        const barWidth = 18;
        const barX = wagonStartX + (wagonWidth * index) / 4 - barWidth / 2;
        return polygonWithBricks(
          "smallIron",
          {
            vertices: createRectangle(
              barX,
              wagonTopY + frameThickness / 2,
              barWidth,
              wagonHeight - frameThickness,
            ),
          },
          { level: ironLevel },
        );
      });

      const wagonWheelY = wagonBottomY + 25;
      const wagonWheelRadius = 45;
      const wagonWheels = [
        circleWithBricks(
          "compactIron",
          {
            center: { x: wagonStartX + 180, y: wagonWheelY },
            outerRadius: wagonWheelRadius,
          },
          { level: baseLevel },
        ),
        circleWithBricks(
          "compactIron",
          {
            center: { x: wagonEndX - 180, y: wagonWheelY },
            outerRadius: wagonWheelRadius,
          },
          { level: baseLevel },
        ),
      ];

      const tractorStartX = center.x + 220;
      const tractorEndX = center.x + 680;
      const tractorRearWheelX = tractorStartX + 90;
      const tractorFrontWheelX = tractorEndX - 90;
      const tractorWheelY = wagonWheelY;

      const tractorWheels = [
        circleWithBricks(
          "compactIron",
          {
            center: { x: tractorRearWheelX, y: tractorWheelY },
            outerRadius: 52,
          },
          { level: baseLevel },
        ),
        circleWithBricks(
          "compactIron",
          {
            center: { x: tractorFrontWheelX, y: tractorWheelY },
            outerRadius: 40,
          },
          { level: baseLevel },
        ),
      ];

      const cabWidth = 170;
      const cabHeight = 220;
      const cabBottomY = wagonBottomY - 5;
      const cabTopY = cabBottomY - cabHeight;
      const cabX = tractorRearWheelX - cabWidth / 2;

      const tractorCab = polygonWithBricks(
        "smallIron",
        {
          vertices: createRectangle(cabX, cabTopY, cabWidth, cabHeight),
          holes: [
            createRectangle(
              cabX + 30,
              cabTopY + 30,
              cabWidth - 60,
              cabHeight - 120,
            ),
          ],
        },
        { level: ironLevel+1 },
      );

      const hoodBackX = cabX + cabWidth;
      const hoodFrontX = tractorEndX - 20;
      const hoodBottomY = cabBottomY + 18;
      const hoodTopY = cabBottomY - 95;

      const tractorHood = polygonWithBricks(
        "smallIron",
        {
          vertices: [
            { x: hoodBackX, y: hoodBottomY },
            { x: hoodFrontX, y: hoodBottomY },
            { x: hoodFrontX - 30, y: hoodTopY },
            { x: hoodBackX, y: hoodTopY },
          ],
        },
        { level: ironLevel+1 },
      );

      return [
        coalPile,
        wagonFrame,
        ...wagonGridBars,
        ...wagonWheels,
        tractorCab,
        tractorHood,
        ...tractorWheels,
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
        id: "mine",
        level: 1,
      },
    ],
    mapsRequired: { mine: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
