import type { SaveSlotId } from "../types";

export interface AppUiApi {
  selectSlot(slot: SaveSlotId): void;
  returnToMainMenu(): void;
}

declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    app: AppUiApi;
  }
}
