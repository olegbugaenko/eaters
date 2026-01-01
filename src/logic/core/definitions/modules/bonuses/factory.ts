import { BonusesModule } from "../../../../modules/shared/BonusesModule";
import { ServiceDefinition } from "../../types";

export const createBonusesDefinition = (): ServiceDefinition<BonusesModule> => ({
  token: "bonuses",
  factory: () => new BonusesModule(),
  registerAsModule: true,
});
