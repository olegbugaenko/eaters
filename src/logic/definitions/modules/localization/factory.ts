import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { LocalizationService } from "@logic/services/localization/LocalizationService";

export const createLocalizationDefinition = (): ServiceDefinition<LocalizationService, "localization"> => ({
  token: "localization",
  factory: () => new LocalizationService(),
  onReady: (instance, container) => {
    instance.attachBridge(container.get("bridge"));
  },
});
