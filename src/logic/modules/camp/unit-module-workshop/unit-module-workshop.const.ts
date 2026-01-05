import type { UnitModuleWorkshopBridgeState } from "./unit-module-workshop.types";
import type { SkillId } from "../../../../db/skills-db";

export const DEFAULT_UNIT_MODULE_WORKSHOP_STATE: UnitModuleWorkshopBridgeState = Object.freeze({
  unlocked: false,
  modules: [],
});

export const UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY = "unitModules/workshop";

export const MODULE_UNLOCK_SKILL_ID: SkillId = "void_modules";
