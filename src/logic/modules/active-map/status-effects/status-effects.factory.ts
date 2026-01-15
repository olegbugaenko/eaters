import type { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { StatusEffectsModule } from "./status-effects.module";

export const createStatusEffectsDefinition = (): ServiceDefinition<
  StatusEffectsModule,
  "statusEffects"
> => ({
  token: "statusEffects",
  factory: (container) =>
    new StatusEffectsModule({
      damage: container.get("damage"),
    }),
  registerAsModule: true,
  dependsOn: ["damage"],
});
