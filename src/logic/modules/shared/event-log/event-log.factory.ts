import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { EventLogModule } from "./event-log.module";

export const createEventLogDefinition = (): ServiceDefinition<EventLogModule, "eventLog"> => ({
  token: "eventLog",
  factory: (container) =>
    new EventLogModule({
      bridge: container.get("bridge"),
      time: container.get("time"),
    }),
  registerAsModule: true,
  dependsOn: ["time"],
});
