import type { SkillTreeBridgePayload } from "./skill-tree.types";

export const SKILL_TREE_STATE_BRIDGE_KEY = "skills/tree";
export const SKILL_TREE_VIEW_TRANSFORM_BRIDGE_KEY = "skills/treeViewTransform";

export const DEFAULT_SKILL_TREE_STATE: SkillTreeBridgePayload = Object.freeze({
  nodes: [],
});
