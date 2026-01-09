import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { ResourcesModule } from "./resources.module";
import { BonusesValueAdapter } from "../bonuses/bonuses.adapter";
import { UnlockProgressionAdapter } from "../../../services/unlock/unlock-progression.adapter";
import { MapRunContextAdapter } from "../../active-map/map/map-run-context.adapter";

export const createResourcesDefinition = (): ServiceDefinition<ResourcesModule, "resources"> => ({
  token: "resources",
  factory: (container) =>
    new ResourcesModule({
      bridge: container.get("bridge"),
      progression: new UnlockProgressionAdapter(container.get("unlocks")),
      bonusValues: new BonusesValueAdapter(container.get("bonuses")),
      runtimeContext: new MapRunContextAdapter(container.get("mapRunState")),
      statistics: container.get("statistics"),
    }),
  registerAsModule: true,
  dependsOn: ["unlocks", "bonuses", "statistics"],
});
