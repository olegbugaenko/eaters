import { UnitDesignModule } from "../../../../modules/camp/UnitDesignModule";
import { ServiceDefinition } from "../../types";

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
