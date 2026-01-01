import { SkillId } from "../../../../db/skills-db";
import { UnlockService } from "../../../services/UnlockService";
import { SkillTreeModule } from "../../../modules/camp/SkillTreeModule";
import { MapModule } from "../../../modules/active-map/MapModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createUnlocksDefinition = (): ServiceDefinition<UnlockService> => ({
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
