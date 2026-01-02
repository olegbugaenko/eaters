import { ServiceDefinition } from "../../../core/loader/types";
import { TestTimeModule } from "./time.module";

export const createTimeDefinition = (): ServiceDefinition<TestTimeModule, "time"> => ({
  token: "time",
  factory: (container) =>
    new TestTimeModule({
      bridge: container.get("bridge"),
    }),
  registerAsModule: true,
});
