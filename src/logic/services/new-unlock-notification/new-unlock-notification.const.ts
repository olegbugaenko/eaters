import type { NewUnlockNotificationBridgeState } from "./new-unlock-notification.types";

export const NEW_UNLOCKS_BRIDGE_KEY = "newUnlocks/state" as const;

export const DEFAULT_NEW_UNLOCKS_STATE: NewUnlockNotificationBridgeState = Object.freeze({
  unseenPaths: [],
  unseenByPrefix: {},
  topLevelUnseen: [],
});
