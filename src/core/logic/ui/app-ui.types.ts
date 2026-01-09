import type { SaveSlotId } from "../types";

export interface AppUiApi {
  selectSlot(slot: SaveSlotId): void;
  returnToMainMenu(): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    app: AppUiApi;
  }
}
