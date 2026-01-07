import type { SceneVector2 } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { PassabilityTag } from "./passability.types";

export interface ObstacleDescriptor {
  readonly position: SceneVector2;
  readonly radius: number;
  readonly passableFor?: readonly PassabilityTag[];
}

export interface ObstacleProvider {
  forEachObstacleNear(
    position: SceneVector2,
    radius: number,
    visitor: (obstacle: ObstacleDescriptor) => void
  ): void;
  
  /**
   * Ітерує через ВСІ перешкоди без просторової фільтрації.
   * Швидше ніж forEachObstacleNear з величезним радіусом.
   */
  forEachObstacle?(visitor: (obstacle: ObstacleDescriptor) => void): void;
}

