import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { StatisticsModule } from "./statistics.module";

export const createStatisticsDefinition = (): ServiceDefinition<StatisticsModule, "statistics"> => ({
  token: "statistics",
  factory: (container) =>
    new StatisticsModule({
      bridge: container.get("bridge"),
    }),
  registerAsModule: true,
});
