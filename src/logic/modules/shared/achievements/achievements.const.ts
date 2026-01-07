import { AchievementsBridgePayload } from "./achievements.types";

export const ACHIEVEMENTS_BRIDGE_KEY = "achievements/list";

export const DEFAULT_ACHIEVEMENTS_STATE: AchievementsBridgePayload = Object.freeze({
  achievements: [],
});
