import type { DataBridge } from "@/core/logic/ui/DataBridge";

export type UnlockCheck = () => boolean;

export interface NewUnlockNotificationRegistration {
  readonly path: string;
  readonly isUnlocked: UnlockCheck;
}

export interface NewUnlockNotificationBridgeState {
  readonly unseenPaths: string[];
  readonly unseenByPrefix: Record<string, string[]>;
  readonly topLevelUnseen: string[];
}

export interface NewUnlockNotificationSaveData {
  readonly viewed?: string[];
}

export interface NewUnlockNotificationOptions {
  readonly bridge: DataBridge;
}

export interface NewUnlockNotificationUiApi {
  markViewed(path: string): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    newUnlocks: NewUnlockNotificationUiApi;
  }
}
