import type { SkillId } from "../../../../db/skills-db";
import type { UnitAutomationBridgeState } from "./unit-automation.types";

export const UNIT_AUTOMATION_STATE_BRIDGE_KEY = "automation/state";

export const DEFAULT_UNIT_AUTOMATION_STATE: UnitAutomationBridgeState = Object.freeze({
  unlocked: false,
  units: [],
});

export const AUTOMATION_SKILL_ID: SkillId = "stone_automatons";
export const MAX_AUTOMATION_ITERATIONS = 32;
export const MAX_AUTOMATION_FAILURES_BEFORE_FALLBACK = 32;
export const AUTOMATION_SELECTION_EPSILON = 1e-6;
