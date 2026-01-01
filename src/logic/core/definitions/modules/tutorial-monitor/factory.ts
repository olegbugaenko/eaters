import { TutorialMonitorModule } from "../../../../modules/active-map/TutorialMonitorModule";
import { ServiceDefinition } from "../../types";

export const createTutorialMonitorDefinition = (): ServiceDefinition<TutorialMonitorModule> => ({
  token: "tutorialMonitor",
  factory: (container) =>
    new TutorialMonitorModule({
      bridge: container.get("bridge"),
      necromancer: container.get("necromancer"),
      resources: container.get("resources"),
      runState: container.get("mapRunState"),
    }),
  registerAsModule: true,
});
