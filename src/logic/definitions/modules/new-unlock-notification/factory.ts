import { ServiceDefinition } from "@/core/logic/engine/loader/types";
import { NewUnlockNotificationService } from "@/logic/services/new-unlock-notification/NewUnlockNotification";

export const createNewUnlockNotificationDefinition = (): ServiceDefinition<
  NewUnlockNotificationService,
  "newUnlocks"
> => ({
  token: "newUnlocks",
  factory: (container) =>
    new NewUnlockNotificationService({
      bridge: container.get("bridge"),
    }),
  registerAsModule: true,
  dependsOn: ["bridge"],
});
