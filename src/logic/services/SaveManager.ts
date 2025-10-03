import { GameModule, SaveSlotId, StoredSaveData } from "../core/types";

const STORAGE_KEY_PREFIX = "eaters-save-slot-";

export class SaveManager {
  private modules: GameModule[] = [];
  private activeSlot: SaveSlotId | null = null;
  private autoSaveTimer: number | null = null;

  public registerModule(module: GameModule): void {
    this.modules.push(module);
  }

  public setActiveSlot(slot: SaveSlotId): void {
    this.stopAutoSave();
    this.activeSlot = slot;
  }

  public loadActiveSlot(): void {
    if (!this.activeSlot) {
      throw new Error("Active slot is not selected");
    }
    const stored = this.readSlotData(this.activeSlot);
    this.modules.forEach((module) => {
      const moduleData = stored?.modules[module.id];
      module.load(moduleData);
    });
  }

  public saveActiveSlot(): void {
    if (!this.activeSlot) {
      return;
    }
    const data: StoredSaveData = {
      modules: {},
    };
    this.modules.forEach((module) => {
      data.modules[module.id] = module.save();
    });
    this.writeSlotData(this.activeSlot, data);
  }

  public startAutoSave(intervalMs: number): void {
    if (intervalMs <= 0) {
      return;
    }
    this.stopAutoSave();
    this.autoSaveTimer = window.setInterval(() => {
      this.saveActiveSlot();
    }, intervalMs);
  }

  public stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  public clearActiveSlot(): void {
    this.stopAutoSave();
    this.activeSlot = null;
  }

  private readSlotData(slot: SaveSlotId): StoredSaveData | null {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${slot}`);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as StoredSaveData;
    } catch (error) {
      console.error("Failed to read save slot", error);
      return null;
    }
  }

  private writeSlotData(slot: SaveSlotId, data: StoredSaveData): void {
    try {
      const raw = JSON.stringify(data);
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${slot}`, raw);
    } catch (error) {
      console.error("Failed to write save slot", error);
    }
  }
}
