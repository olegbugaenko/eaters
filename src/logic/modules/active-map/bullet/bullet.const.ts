import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";

/**
 * Reusable update payload for bullet position updates.
 * Used to avoid creating new objects on every update.
 */
export const REUSABLE_UPDATE_PAYLOAD: { position: SceneVector2 } = {
  position: { x: 0, y: 0 },
};
