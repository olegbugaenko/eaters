import { ServiceDefinition } from "../../core/loader/types";
import { BonusesModule } from "./bonuses.module";

export const createBonusesDefinition = (): ServiceDefinition<BonusesModule> => ({
  token: "bonuses",
  factory: () => new BonusesModule(),
  registerAsModule: true,
});
