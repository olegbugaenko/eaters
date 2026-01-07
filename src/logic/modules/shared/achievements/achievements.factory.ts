import { ServiceDefinition } from "../../../core/loader/types";
import { AchievementsModule } from "./achievements.module";

export const createAchievementsDefinition = (): ServiceDefinition<AchievementsModule, "achievements"> => ({
  token: "achievements",
  factory: (container) =>
    new AchievementsModule({
      bridge: container.get("bridge"),
      bonuses: container.get("bonuses"),
    }),
  registerAsModule: true,
});
