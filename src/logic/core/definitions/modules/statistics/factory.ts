import { StatisticsModule } from "../../../../modules/shared/StatisticsModule";
import { ServiceDefinition } from "../../types";

export const createStatisticsDefinition = (): ServiceDefinition<StatisticsModule> => ({
  token: "statistics",
  factory: (container) =>
    new StatisticsModule({
      bridge: container.get("bridge"),
    }),
  registerAsModule: true,
});
