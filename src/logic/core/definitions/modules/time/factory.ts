import { TestTimeModule } from "../../../../modules/shared/TestTimeModule";
import { ServiceDefinition } from "../../types";

export const createTimeDefinition = (): ServiceDefinition<TestTimeModule> => ({
  token: "time",
  factory: (container) =>
    new TestTimeModule({
      bridge: container.get("bridge"),
    }),
  registerAsModule: true,
});
