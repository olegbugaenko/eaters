import type { SceneSize, SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { circleWithBricks } from "../../../logic/services/brick-layout/BrickLayoutService";
import type { MapConfig } from "../maps-db.types";

const mapConfig = (() => {
  const center: SceneVector2 = { x: 500, y: 600 };
  const size: SceneSize = { width: 1000, height: 1000 };
  const spawnPoint: SceneVector2 = { x: center.x, y: center.y - 500 };

  const scale = 0.92;
  // Голова смайлика
  const headRadius = Math.round(280 * scale);
  const headThickness = Math.round(20 * scale);

  // Очі
  const eyeRadius = Math.round(35 * scale);
  const eyeOffsetY = Math.round(-60 * scale);
  const eyeOffsetX = Math.round(80 * scale);

  // Рот (дуга) - створюємо через сегменти кіл
  const mouthRadius = Math.round(120 * scale);
  const mouthThickness = headThickness;
  const mouthCenterY = center.y + Math.round(50 * scale);
  const mouthStartAngle = Math.PI * 0.25; // ~45 градусів
  const mouthEndAngle = Math.PI * 0.75; // ~135 градусів
  const mouthSegments = 8; // кількість сегментів для рота

  return {
    name: "Optimistic Smile",
    size,
    spawnPoints: [spawnPoint],
    icon: "training.png",
    bricks: ({ mapLevel }) => {
      const baseLevel = Math.max(0, Math.floor(mapLevel));

      // Голова (зовнішнє коло)
      const headOuter = circleWithBricks(
        "smallTrainingBrick",
        {
          center,
          innerRadius: headRadius - headThickness,
          outerRadius: headRadius,
        },
        { level: baseLevel },
      );

      // Ліве око
      const leftEye = circleWithBricks(
        "smallTrainingBrick",
        {
          center: { x: center.x - eyeOffsetX, y: center.y + eyeOffsetY },
          innerRadius: 0,
          outerRadius: eyeRadius,
        },
        { level: baseLevel },
      );

      // Праве око
      const rightEye = circleWithBricks(
        "smallTrainingBrick",
        {
          center: { x: center.x + eyeOffsetX, y: center.y + eyeOffsetY },
          innerRadius: 0,
          outerRadius: eyeRadius,
        },
        { level: baseLevel },
      );

      // Рот (дуга) - створюємо через сегменти кіл
      const mouthSegmentsArray = Array.from(
        { length: mouthSegments },
        (_, i) => {
          const t = i / (mouthSegments - 1);
          const angle =
            mouthStartAngle + (mouthEndAngle - mouthStartAngle) * t;
          const segmentCenter: SceneVector2 = {
            x: center.x + Math.cos(angle) * mouthRadius,
            y: mouthCenterY + Math.sin(angle) * mouthRadius,
          };
          return circleWithBricks(
            "smallTrainingBrick",
            {
              center: segmentCenter,
              innerRadius: 0,
              outerRadius: mouthThickness,
            },
            { level: baseLevel },
          );
        },
      );

      return [headOuter, leftEye, rightEye, ...mouthSegmentsArray];
    },
    playerUnits: [
      {
        type: "bluePentagon",
        position: { ...spawnPoint },
      },
    ],
    nodePosition: { x: 0, y: 0 },
    mapsRequired: { tutorialZone: 1 },
    maxLevel: 1,
  } satisfies MapConfig;
})();

export default mapConfig;
