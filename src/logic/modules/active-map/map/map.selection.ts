import { MapId } from "../../../../db/maps-db";
import { MapSaveData } from "./map.types";

export class MapSelectionState {
  private selectedMapId: MapId | null = null;
  private selectedMapLevel = 0;
  private mapSelectedLevels: Partial<Record<MapId, number>> = {};
  private lastPlayedMap: { mapId: MapId; level: number } | null = null;

  constructor(private readonly defaultMapId: MapId) {}

  public reset(): void {
    this.selectedMapId = null;
    this.selectedMapLevel = 0;
    this.mapSelectedLevels = {};
    this.lastPlayedMap = null;
  }

  public loadFromSave(parsed: MapSaveData | undefined): void {
    this.mapSelectedLevels = parsed?.selectedLevels ?? {};
    this.lastPlayedMap = parsed?.lastPlayedMap ?? null;
  }

  public applySavedSelection(
    mapId: MapId | null,
    mapLevel: number | undefined,
    isMapSelectable: (mapId: MapId) => boolean,
    clampLevelToUnlocked: (mapId: MapId, level: number) => number,
  ): void {
    if (mapId && isMapSelectable(mapId)) {
      this.selectedMapId = mapId;
      if (typeof mapLevel === "number") {
        this.mapSelectedLevels[mapId] = clampLevelToUnlocked(mapId, mapLevel);
      }
      return;
    }
    this.selectedMapId = null;
    this.selectedMapLevel = 0;
  }

  public ensureSelection(resolveSelectableMapId: (candidate: MapId | null) => MapId | null): void {
    const mapId = resolveSelectableMapId(this.selectedMapId ?? this.defaultMapId);
    if (!mapId) {
      this.selectedMapId = null;
      this.selectedMapLevel = 0;
      return;
    }
    this.selectedMapId = mapId;
  }

  public updateSelection(mapId: MapId, level: number): void {
    this.selectedMapId = mapId;
    this.selectedMapLevel = level;
    this.mapSelectedLevels[mapId] = level;
  }

  public setSelectedLevel(mapId: MapId, level: number): void {
    this.mapSelectedLevels[mapId] = level;
    if (this.selectedMapId === mapId) {
      this.selectedMapLevel = level;
    }
  }

  public clearSelection(): void {
    this.selectedMapId = null;
    this.selectedMapLevel = 0;
  }

  public recordLastPlayed(mapId: MapId, level: number): void {
    this.lastPlayedMap = { mapId, level };
  }

  public setLastPlayedMap(lastPlayed: { mapId: MapId; level: number } | null): void {
    this.lastPlayedMap = lastPlayed;
  }

  public getSelectedMapId(): MapId | null {
    return this.selectedMapId;
  }

  public getSelectedMapLevel(): number {
    return this.selectedMapLevel;
  }

  public getSelectedLevels(): Partial<Record<MapId, number>> {
    return this.mapSelectedLevels;
  }

  public getLastPlayedMap(): { mapId: MapId; level: number } | null {
    return this.lastPlayedMap;
  }
}

