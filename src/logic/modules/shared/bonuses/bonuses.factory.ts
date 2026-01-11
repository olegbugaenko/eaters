import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { BonusesModule } from "./bonuses.module";

export const createBonusesDefinition = (): ServiceDefinition<BonusesModule, "bonuses"> => ({
  token: "bonuses",
  factory: () => new BonusesModule(),
  registerAsModule: true,
});
