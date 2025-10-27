import {
  GameModule,
  SaveSlotId,
  StoredSaveData,
} from "../core/types";

export interface SaveSlotSummary {
  readonly hasSave: boolean;
  readonly timePlayedMs: number | null;
  readonly updatedAt: number | null;
  readonly createdAt: number | null;
}

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
    const now = Date.now();
    const previous = this.readSlotData(this.activeSlot);
    const data: StoredSaveData = {
      modules: {},
      meta: {
        createdAt: previous?.meta?.createdAt ?? now,
        updatedAt: now,
      },
    };
    this.modules.forEach((module) => {
      data.modules[module.id] = module.save();
    });
    this.writeSlotData(this.activeSlot, data);
  }

  public getSlotSummary(slot: SaveSlotId): SaveSlotSummary {
    const stored = this.readSlotData(slot);
    if (!stored) {
      return {
        hasSave: false,
        timePlayedMs: null,
        updatedAt: null,
        createdAt: null,
      };
    }

    return {
      hasSave: true,
      timePlayedMs: this.extractTimePlayed(stored),
      updatedAt: typeof stored.meta?.updatedAt === "number" ? stored.meta.updatedAt : null,
      createdAt: typeof stored.meta?.createdAt === "number"
        ? stored.meta.createdAt
        : typeof stored.meta?.updatedAt === "number"
        ? stored.meta.updatedAt
        : null,
    };
  }

  public deleteSlot(slot: SaveSlotId): void {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${slot}`);
    if (this.activeSlot === slot) {
      this.clearActiveSlot();
    }
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

  public getActiveSlotId(): SaveSlotId | null {
    return this.activeSlot;
  }

  public exportActiveSlot(): StoredSaveData | null {
    if (!this.activeSlot) {
      return null;
    }
    return this.readSlotData(this.activeSlot);
  }

  public importToActiveSlot(data: StoredSaveData): void {
    if (!this.activeSlot) {
      throw new Error("Active slot is not selected");
    }
    if (!data || typeof data !== "object") {
      throw new Error("Invalid save data");
    }

    this.writeSlotData(this.activeSlot, data);
    this.modules.forEach((module) => {
      const moduleData = data.modules?.[module.id];
      module.load(moduleData);
    });
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

  private extractTimePlayed(data: StoredSaveData): number | null {
    const moduleData = data.modules?.["test-time"];
    if (typeof moduleData !== "object" || moduleData === null) {
      return null;
    }
    if (!("timePlayedMs" in moduleData)) {
      return null;
    }
    const value = (moduleData as { timePlayedMs?: unknown }).timePlayedMs;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
}
