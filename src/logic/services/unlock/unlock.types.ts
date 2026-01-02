import type { MapId } from "../../../db/maps-db";
import type { SkillId } from "../../../db/skills-db";
import type { MapStats } from "../../modules/active-map/map/map.types";
import type { UnlockCondition } from "../../../types/unlocks";

export interface UnlockServiceOptions {
  getMapStats: () => MapStats;
  getSkillLevel: (id: SkillId) => number;
}

export type GameUnlockCondition = UnlockCondition<MapId, SkillId>;
