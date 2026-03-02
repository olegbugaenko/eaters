import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { ArtifactId } from "@/db/artifacts-db";
import type { UnlockService } from "@logic/services/unlock/UnlockService";
import type { NewUnlockNotificationService } from "@logic/services/new-unlock-notification/NewUnlockNotification";
import type { LocalizationService } from "@logic/services/localization/LocalizationService";

export interface ArtifactBridgeState {
  readonly id: ArtifactId;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly owned: boolean;
  readonly equippedSlot: number | null;
}

export interface ArtifactsBridgeState {
  readonly unlocked: boolean;
  readonly slotCount: number;
  readonly activeSlots: ReadonlyArray<ArtifactId | null>;
  readonly artifacts: readonly ArtifactBridgeState[];
}

export interface ArtifactsSaveData {
  readonly owned?: ArtifactId[];
  readonly activeSlots?: Array<ArtifactId | null>;
}

export interface ArtifactsRuntimeModifiers {
  readonly sanityDecayMultiplier: number;
  readonly maxUnitsFlat: number;
}

export interface ArtifactsModuleOptions {
  readonly bridge: DataBridge;
  readonly unlocks: UnlockService;
  readonly newUnlocks: NewUnlockNotificationService;
  readonly localization?: LocalizationService;
}

export interface ArtifactsModuleUiApi {
  equipArtifact(slotIndex: number, artifactId: ArtifactId | null): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    artifacts: ArtifactsModuleUiApi;
  }
}
