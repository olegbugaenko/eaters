import { SkillId } from "../../../../db/skills-db";
import { UnlockService } from "../../../services/unlock/UnlockService";
import { SkillTreeModule } from "../../../modules/camp/skill-tree/skill-tree.module";
import { MapModule } from "../../../modules/active-map/map/map.module";
import { ServiceDefinition } from "@/core/logic/engine/loader/types";

export const createUnlocksDefinition = (): ServiceDefinition<UnlockService, "unlocks"> => ({
  token: "unlocks",
  factory: (container) =>
    new UnlockService({
      getMapStats: () => {
        try {
          return container.get<MapModule>("map").getMapStats();
        } catch {
          return {};
        }
      },
      getSkillLevel: (id: SkillId) => {
        try {
          return container.get<SkillTreeModule>("skillTree").getLevel(id);
        } catch {
          return 0;
        }
      },
    }),
});
