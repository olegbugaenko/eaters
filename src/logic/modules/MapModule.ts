import { DataBridge } from "../core/DataBridge";
import { GameModule } from "../core/types";
import { SceneObjectManager, SceneSize } from "../services/SceneObjectManager";
import { BricksModule, BrickData } from "./BricksModule";
import {
  PlayerUnitsModule,
  PlayerUnitSpawnData,
} from "./PlayerUnitsModule";
import {
  MapConfig,
  MapId,
  MapListEntry,
  getMapConfig,
  getMapList,
  isMapId,
} from "../../db/maps-db";
import { SceneVector2 } from "../services/SceneObjectManager";

export const MAP_LIST_BRIDGE_KEY = "maps/list";
export const MAP_SELECTED_BRIDGE_KEY = "maps/selected";

interface MapModuleOptions {
  scene: SceneObjectManager;
  bridge: DataBridge;
  bricks: BricksModule;
  playerUnits: PlayerUnitsModule;
}

interface MapSaveData {
  mapId: MapId;
}

const DEFAULT_MAP_ID: MapId = "initial";

export class MapModule implements GameModule {
  public readonly id = "maps";

  private selectedMapId: MapId | null = null;

  constructor(private readonly options: MapModuleOptions) {}

  public initialize(): void {
    this.pushMapList();
    this.ensureSelection({ generateBricks: false, generateUnits: false });
  }

  public reset(): void {
    this.ensureSelection({ generateBricks: true, generateUnits: true });
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.selectedMapId = parsed.mapId;
      this.applyMap(parsed.mapId, { generateBricks: false, generateUnits: false });
      return;
    }
    this.pushSelectedMap();
  }

  public save(): unknown {
    return {
      mapId: this.selectedMapId ?? DEFAULT_MAP_ID,
    } satisfies MapSaveData;
  }

  public tick(_deltaMs: number): void {
    // Map logic is static for now.
  }

  public selectMap(mapId: MapId): void {
    if (!isMapId(mapId)) {
      return;
    }
    this.selectedMapId = mapId;
    this.applyMap(mapId, { generateBricks: true, generateUnits: true });
  }

  private ensureSelection(options: { generateBricks: boolean; generateUnits: boolean }): void {
    const mapId = this.selectedMapId ?? DEFAULT_MAP_ID;
    this.selectedMapId = mapId;
    this.applyMap(mapId, options);
  }

  private applyMap(
    mapId: MapId,
    options: { generateBricks: boolean; generateUnits: boolean }
  ): void {
    const config = getMapConfig(mapId);
    this.options.scene.setMapSize(config.size);
    if (options.generateBricks) {
      const bricks = this.generateBricks(config);
      this.options.bricks.setBricks(bricks);
    }
    if (options.generateUnits) {
      const units = this.generatePlayerUnits(config);
      this.options.playerUnits.setUnits(units);
    }
    this.pushSelectedMap();
  }

  private generateBricks(config: MapConfig): BrickData[] {
    const bricks: BrickData[] = [];
    config.bricks.forEach((group) => {
      for (let index = 0; index < group.count; index += 1) {
        bricks.push({
          position: this.getRandomPosition(config.size),
          rotation: Math.random() * Math.PI * 2,
          type: group.type,
        });
      }
    });
    return bricks;
  }

  private generatePlayerUnits(config: MapConfig): PlayerUnitSpawnData[] {
    if (!config.playerUnits) {
      return [];
    }
    return config.playerUnits.map((unit) => ({
      type: unit.type,
      position: this.clampToMap(unit.position, config.size),
    }));
  }

  private getRandomPosition(size: SceneSize): BrickData["position"] {
    return {
      x: Math.random() * size.width,
      y: Math.random() * size.height,
    };
  }

  private clampToMap(position: SceneVector2, size: SceneSize): SceneVector2 {
    return {
      x: clamp(position.x, 0, size.width),
      y: clamp(position.y, 0, size.height),
    };
  }

  private pushMapList(): void {
    const list = getMapList();
    this.options.bridge.setValue<MapListEntry[]>(MAP_LIST_BRIDGE_KEY, list);
  }

  private pushSelectedMap(): void {
    this.options.bridge.setValue<MapId | null>(MAP_SELECTED_BRIDGE_KEY, this.selectedMapId);
  }

  private parseSaveData(data: unknown): MapSaveData | null {
    if (
      typeof data === "object" &&
      data !== null &&
      "mapId" in data &&
      isMapId((data as { mapId: unknown }).mapId)
    ) {
      return { mapId: (data as { mapId: MapId }).mapId };
    }
    return null;
  }
}

export type { MapListEntry };

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isFinite(value)) {
    if (min > max) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }
  return min;
};
