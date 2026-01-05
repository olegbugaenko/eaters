import { ServiceDefinition } from "../../../core/loader/types";
import { CraftingModule } from "./crafting.module";

export const createCraftingDefinition = (): ServiceDefinition<CraftingModule, "crafting"> => ({
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
