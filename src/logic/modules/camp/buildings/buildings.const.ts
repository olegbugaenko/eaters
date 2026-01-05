import type { SkillId } from "../../../../db/skills-db";
import type { BuildingsWorkshopBridgeState } from "./buildings.types";

export const DEFAULT_BUILDINGS_WORKSHOP_STATE: BuildingsWorkshopBridgeState = Object.freeze({
  unlocked: false,
  buildings: [],
});

export const BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY = "buildings/workshop";
export const BUILDINGS_UNLOCK_SKILL_ID: SkillId = "construction_guild";
