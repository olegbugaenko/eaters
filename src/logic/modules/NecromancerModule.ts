import { GameModule } from "../core/types";
import { DataBridge } from "../core/DataBridge";
import { PlayerUnitsModule, PlayerUnitSpawnData } from "./PlayerUnitsModule";
import {
  PlayerUnitType,
  PLAYER_UNIT_TYPES,
  getPlayerUnitConfig,
} from "../../db/player-units-db";
import { SceneObjectManager, SceneVector2 } from "../services/SceneObjectManager";
import { ResourceAmountMap, normalizeResourceCost } from "../../types/resources";
import { BonusesModule, BonusValueMap } from "./BonusesModule";

export interface NecromancerResourceMeter {
  current: number;
  max: number;
}

export interface NecromancerResourcesPayload {
  mana: NecromancerResourceMeter;
  sanity: NecromancerResourceMeter;
}

export interface NecromancerSpawnOption {
  type: PlayerUnitType;
  name: string;
  cost: ResourceAmountMap;
}

export const NECROMANCER_RESOURCES_BRIDGE_KEY = "necromancer/resources";
export const NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY = "necromancer/spawnOptions";

interface NecromancerModuleOptions {
  bridge: DataBridge;
  playerUnits: PlayerUnitsModule;
  scene: SceneObjectManager;
  bonuses: BonusesModule;
}

interface NecromancerSaveData {
  mana: number;
  sanity: number;
}

interface ResourceState {
  current: number;
  max: number;
  regenPerSecond: number;
}

const SPAWN_JITTER_RADIUS = 30;

export class NecromancerModule implements GameModule {
  public readonly id = "necromancer";

  private readonly bridge: DataBridge;
  private readonly playerUnits: PlayerUnitsModule;
  private readonly scene: SceneObjectManager;
  private readonly bonuses: BonusesModule;

  private mana: ResourceState = {
    current: 0,
    max: 0,
    regenPerSecond: 0,
  };

  private sanity: ResourceState = {
    current: 0,
    max: 0,
    regenPerSecond: 0,
  };

  private spawnPoints: SceneVector2[] = [];
  private nextSpawnIndex = 0;
  private pendingLoad: ResourceAmountMap | null = null;
  private resourcesDirty = true;

  constructor(options: NecromancerModuleOptions) {
    this.bridge = options.bridge;
    this.playerUnits = options.playerUnits;
    this.scene = options.scene;
    this.bonuses = options.bonuses;
    this.bonuses.subscribe((values) => {
      this.handleBonusValuesChanged(values);
    });
  }

  public initialize(): void {
    this.applyCurrentBonusValues();
    this.pushSpawnOptions();
    this.pushResources();
  }

  public reset(): void {
    this.spawnPoints = [];
    this.nextSpawnIndex = 0;
    this.pendingLoad = null;
    this.mana.current = 0;
    this.mana.max = 0;
    this.mana.regenPerSecond = 0;
    this.sanity.current = 0;
    this.sanity.max = 0;
    this.sanity.regenPerSecond = 0;
    this.markResourcesDirty();
    this.pushResources();
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed) {
      this.pendingLoad = parsed;
    }
  }

  public save(): unknown {
    return {
      mana: clampNumber(this.mana.current, 0, this.mana.max),
      sanity: clampNumber(this.sanity.current, 0, this.sanity.max),
    } satisfies NecromancerSaveData;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    let changed = false;

    if (this.mana.regenPerSecond > 0 && this.mana.current < this.mana.max) {
      const next = clampNumber(
        this.mana.current + this.mana.regenPerSecond * deltaSeconds,
        0,
        this.mana.max
      );
      if (Math.abs(next - this.mana.current) > 0.0001) {
        this.mana.current = next;
        changed = true;
      }
    }

    if (changed) {
      this.markResourcesDirty();
    }

    if (this.resourcesDirty) {
      this.pushResources();
    }
  }

  public configureForMap(options: { spawnPoints: SceneVector2[] }): void {
    const mapSize = this.scene.getMapSize();
    this.spawnPoints = options.spawnPoints.map((point) => ({
      x: clampNumber(point.x, 0, mapSize.width),
      y: clampNumber(point.y, 0, mapSize.height),
    }));
    this.nextSpawnIndex = 0;

    this.applyCurrentBonusValues();
    this.mana.current = this.mana.max;
    this.sanity.current = this.sanity.max;
    this.markResourcesDirty();

    this.applyPendingLoad();
    this.pushResources();
  }

  public trySpawnUnit(type: PlayerUnitType): boolean {
    const config = getPlayerUnitConfig(type);
    const cost = normalizeResourceCost(config.cost);

    if (!this.canAfford(cost)) {
      return false;
    }

    const spawnPosition = this.getNextSpawnPosition();
    const spawnData: PlayerUnitSpawnData = {
      type,
      position: spawnPosition,
    };

    this.consumeResources(cost);
    this.playerUnits.spawnUnit(spawnData);
    this.markResourcesDirty();
    this.pushResources();
    return true;
  }

  public hasSanityForAnySpawn(): boolean {
    const currentSanity = this.sanity.current;
    return PLAYER_UNIT_TYPES.some((type) => {
      const config = getPlayerUnitConfig(type);
      const cost = normalizeResourceCost(config.cost);
      return currentSanity >= cost.sanity;
    });
  }

  private pushSpawnOptions(): void {
    const options: NecromancerSpawnOption[] = PLAYER_UNIT_TYPES.map((type) => {
      const config = getPlayerUnitConfig(type);
      return {
        type,
        name: config.name,
        cost: normalizeResourceCost(config.cost),
      };
    });
    this.bridge.setValue(NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY, options);
  }

  private getNextSpawnPosition(): SceneVector2 {
    let base: SceneVector2 | null = null;

    if (this.spawnPoints.length > 0) {
      const index = this.nextSpawnIndex % this.spawnPoints.length;
      base = this.spawnPoints[index]!;
      this.nextSpawnIndex = (index + 1) % this.spawnPoints.length;
    }

    if (!base) {
      const mapSize = this.scene.getMapSize();
      base = {
        x: clampNumber(100, 0, mapSize.width),
        y: clampNumber(100, 0, mapSize.height),
      };
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * SPAWN_JITTER_RADIUS;
    const jitter: SceneVector2 = {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };

    const target: SceneVector2 = {
      x: base.x + jitter.x,
      y: base.y + jitter.y,
    };

    return this.clampToMap(target);
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }

  private consumeResources(cost: ResourceAmountMap): void {
    this.mana.current = clampNumber(this.mana.current - cost.mana, 0, this.mana.max);
    this.sanity.current = clampNumber(this.sanity.current - cost.sanity, 0, this.sanity.max);
  }

  private canAfford(cost: ResourceAmountMap): boolean {
    if (this.mana.current < cost.mana) {
      return false;
    }
    if (this.sanity.current < cost.sanity) {
      return false;
    }
    return true;
  }

  private applyCurrentBonusValues(): void {
    this.handleBonusValuesChanged(this.bonuses.getAllValues());
  }

  private handleBonusValuesChanged(values: BonusValueMap): void {
    const manaCap = sanitizeBonusValue(values["mana_cap"], 0);
    const sanityCap = sanitizeBonusValue(values["sanity_cap"], 0);
    const manaRegen = sanitizeBonusValue(values["mana_regen"], 0);

    const previousManaMax = this.mana.max;
    const previousSanityMax = this.sanity.max;
    const previousManaRegen = this.mana.regenPerSecond;

    this.mana.max = Math.max(manaCap, 0);
    this.sanity.max = Math.max(sanityCap, 0);
    this.mana.regenPerSecond = Math.max(manaRegen, 0);

    const clampedMana = clampNumber(this.mana.current, 0, this.mana.max);
    const clampedSanity = clampNumber(this.sanity.current, 0, this.sanity.max);

    const changed =
      previousManaMax !== this.mana.max ||
      previousSanityMax !== this.sanity.max ||
      previousManaRegen !== this.mana.regenPerSecond ||
      clampedMana !== this.mana.current ||
      clampedSanity !== this.sanity.current;

    this.mana.current = clampedMana;
    this.sanity.current = clampedSanity;

    if (changed) {
      this.markResourcesDirty();
    }
  }

  private applyPendingLoad(): void {
    if (!this.pendingLoad) {
      return;
    }

    this.mana.current = clampNumber(this.pendingLoad.mana, 0, this.mana.max);
    this.sanity.current = clampNumber(this.pendingLoad.sanity, 0, this.sanity.max);
    this.pendingLoad = null;
    this.markResourcesDirty();
  }

  private pushResources(): void {
    const payload: NecromancerResourcesPayload = {
      mana: {
        current: clampNumber(this.mana.current, 0, this.mana.max),
        max: this.mana.max,
      },
      sanity: {
        current: clampNumber(this.sanity.current, 0, this.sanity.max),
        max: this.sanity.max,
      },
    };
    this.resourcesDirty = false;
    this.bridge.setValue(NECROMANCER_RESOURCES_BRIDGE_KEY, payload);
  }

  private parseSaveData(data: unknown): ResourceAmountMap | null {
    if (
      typeof data !== "object" ||
      data === null ||
      !("mana" in data) ||
      !("sanity" in data)
    ) {
      return null;
    }

    const { mana, sanity } = data as NecromancerSaveData;
    return {
      mana: sanitizeNumber(mana),
      sanity: sanitizeNumber(sanity),
    };
  }

  private markResourcesDirty(): void {
    this.resourcesDirty = true;
  }
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min > max) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const sanitizeBonusValue = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

const sanitizeNumber = (value: number): number => {
  if (Number.isFinite(value)) {
    return value;
  }
  return 0;
};
