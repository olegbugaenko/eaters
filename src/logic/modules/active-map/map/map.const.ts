import type { MapId } from "../../../../db/maps-db";
import type { SkillId } from "../../../../db/skills-db";
import type { MapAutoRestartState } from "./map.types";

/**
 * DataBridge keys for map module state.
 */
export const MAP_LIST_BRIDGE_KEY = "maps/list";
export const MAP_SELECTED_BRIDGE_KEY = "maps/selected";
export const MAP_SELECTED_LEVEL_BRIDGE_KEY = "maps/selectedLevel";
export const MAP_CLEARED_LEVELS_BRIDGE_KEY = "maps/clearedLevelsTotal";
export const MAP_LAST_PLAYED_BRIDGE_KEY = "maps/lastPlayed";
export const MAP_AUTO_RESTART_BRIDGE_KEY = "maps/autoRestart";
export const MAP_SELECT_VIEW_TRANSFORM_BRIDGE_KEY = "maps/selectViewTransform";
export const MAP_CONTROL_HINTS_COLLAPSED_BRIDGE_KEY = "maps/controlHintsCollapsed";

/**
 * Default map auto-restart state.
 */
export const DEFAULT_MAP_AUTO_RESTART_STATE: MapAutoRestartState = Object.freeze({
  unlocked: false,
  enabled: false,
});

export const DEFAULT_MAP_CONTROL_HINTS_COLLAPSED = false;

/**
 * Default map ID used when no map is selected.
 */
export const DEFAULT_MAP_ID: MapId = "tutorialZone";

/**
 * Safe radius for spawning player units (prevents spawning too close to map edges).
 */
export const PLAYER_UNIT_SPAWN_SAFE_RADIUS = 150;

/**
 * Skill ID required for auto-restart feature.
 */
export const AUTO_RESTART_SKILL_ID: SkillId = "autorestart_rituals";

/**
 * Bonus context key for cleared map levels total.
 */
export const BONUS_CONTEXT_CLEARED_LEVELS = "clearedMapLevelsTotal";
