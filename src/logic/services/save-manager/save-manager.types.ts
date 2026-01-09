import type { SaveSlotId, StoredSaveData } from "../../core/types";

export interface SaveSlotSummary {
  readonly hasSave: boolean;
  readonly timePlayedMs: number | null;
  readonly updatedAt: number | null;
  readonly createdAt: number | null;
}

export interface SaveManagerUiApi {
  getSlotSummary(slot: SaveSlotId): SaveSlotSummary;
  deleteSlot(slot: SaveSlotId): void;
  getActiveSlotId(): SaveSlotId | null;
  exportActiveSlot(): StoredSaveData | null;
  importToActiveSlot(data: StoredSaveData): void;
}

declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    save: SaveManagerUiApi;
  }
}
