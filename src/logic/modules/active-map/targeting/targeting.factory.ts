import { ServiceDefinition } from "../../../core/loader/types";
import { TargetingService } from "./TargetingService";

export const createTargetingDefinition = (): ServiceDefinition<TargetingService, "targeting"> => ({
  token: "targeting",
  factory: () => new TargetingService(),
});
