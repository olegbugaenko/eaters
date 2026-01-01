import { CraftingModule } from "../../../modules/camp/CraftingModule";
import { ServiceDefinition } from "../../../core/loader/types";

export const createCraftingDefinition = (): ServiceDefinition<CraftingModule> => ({
  token: "crafting",
  factory: (container) =>
    new CraftingModule({
      bridge: container.get("bridge"),
      resources: container.get("resources"),
      unlocks: container.get("unlocks"),
      bonuses: container.get("bonuses"),
    }),
  registerAsModule: true,
});
