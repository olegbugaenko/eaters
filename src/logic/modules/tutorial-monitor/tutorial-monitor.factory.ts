import { ServiceDefinition } from "../../core/loader/types";
import { TutorialMonitorModule } from "./tutorial-monitor.module";

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
