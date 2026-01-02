import type { SkillTreeBridgePayload } from "./skill-tree.types";

export const SKILL_TREE_STATE_BRIDGE_KEY = "skills/tree";

export const DEFAULT_SKILL_TREE_STATE: SkillTreeBridgePayload = Object.freeze({
  nodes: [],
});
