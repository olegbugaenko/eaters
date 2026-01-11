import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { normalizeVector } from "@/shared/helpers/vector.helper";

interface ProjectileSpreadOptions {
  count: number;
  spreadAngleDeg: number;
  baseDirection: SceneVector2;
}

export const buildProjectileSpreadDirections = (
  options: ProjectileSpreadOptions,
): SceneVector2[] => {
  const count = Math.max(1, Math.floor(options.count));
  const spreadAngleRad = Math.max(options.spreadAngleDeg, 0) * (Math.PI / 180);
  const normalizedBase = normalizeVector(options.baseDirection) || { x: 1, y: 0 };
  const baseAngle = Math.atan2(normalizedBase.y, normalizedBase.x);
  const spreadRange = spreadAngleRad * 2;
  const stepAngle = spreadRange / Math.max(1, count - 1);
  const directions: SceneVector2[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = count > 1 ? baseAngle - spreadAngleRad + stepAngle * i : baseAngle;
    directions.push({
      x: Math.cos(angle),
      y: Math.sin(angle),
    });
  }

  return directions;
};
