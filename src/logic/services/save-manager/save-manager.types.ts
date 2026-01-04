import type { SaveSlotId, StoredSaveData } from "../../core/types";

export interface SaveSlotSummary {
  readonly hasSave: boolean;
  readonly timePlayedMs: number | null;
  readonly updatedAt: number | null;
  readonly createdAt: number | null;
}
