import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export const BRICK_HIT_SOUND_URL = "/audio/sounds/brick_effects/hit_v2.mp3";
export const BRICK_DESTROY_SOUND_URL = "/audio/sounds/brick_effects/destroy-01.mp3";

export const BRICK_COUNT_BRIDGE_KEY = "bricks/count";
export const BRICK_TOTAL_HP_BRIDGE_KEY = "bricks/totalHp";

export const BRICK_KNOCKBACK_DURATION_MS = 500;
export const KNOCKBACK_EPSILON = 0.001;
export const TOTAL_HP_RECOMPUTE_INTERVAL_MS = 3000;
export const BRICK_DAMAGE_STAGE_COUNT = 3;
export const BRICK_CRACK_VARIANTS_PER_STAGE = 1;

// Re-export for backward compatibility
export { ZERO_VECTOR } from "../../../../shared/helpers/geometry.const";
