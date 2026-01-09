import type { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { StatusEffectsModule } from "./status-effects.module";

export const createStatusEffectsDefinition = (): ServiceDefinition<
  StatusEffectsModule,
  "statusEffects"
> => ({
  token: "statusEffects",
  factory: () => new StatusEffectsModule(),
  registerAsModule: true,
});
