import { ServiceDefinition } from "../../core/loader/types";
import { UnitDesignModule } from "./unit-design.module";

export const createUnitDesignDefinition = (): ServiceDefinition<UnitDesignModule> => ({
  token: "unitDesign",
  factory: (container) =>
    new UnitDesignModule({
      bridge: container.get("bridge"),
      bonuses: container.get("bonuses"),
      workshop: container.get("unitModuleWorkshop"),
    }),
  registerAsModule: true,
});
