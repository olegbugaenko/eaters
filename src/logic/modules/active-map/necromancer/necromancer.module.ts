import { GameModule } from "@core/logic/types";
import { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { PlayerUnitsModule } from "../player-units/player-units.module";
import type { PlayerUnitSpawnData } from "../player-units/player-units.types";
import {
  PlayerUnitType,
  PLAYER_UNIT_TYPES,
  getPlayerUnitConfig,
} from "../../../../db/player-units-db";
import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { ResourceAmountMap } from "@shared/types/resources";
import { normalizeResourceCost } from "@shared/const/resources.const";
import { BonusesModule, BonusValueMap } from "../../shared/bonuses/bonuses.module";
import {
  UnitDesignId,
  UnitDesignerUnitState,
} from "../../camp/unit-design/unit-design.types";
import { UnitDesignModule } from "../../camp/unit-design/unit-design.module";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { sanitizeNumberWithFallback } from "../../../../shared/helpers/numbers.helper";
import { MapRunState } from "../map/MapRunState";
import type {
  NecromancerModuleOptions,
  NecromancerResourceSnapshot,
  NecromancerResourcesPayload,
  NecromancerSaveData,
  NecromancerSpawnOption,
  ResourceState,
} from "./necromancer.types";
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
  NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY,
  SPAWN_JITTER_RADIUS,
  SANITY_DECAY_PER_SECOND,
  SANITY_DEPLETION_THRESHOLD,
  MAX_UNITS_ON_MAP,
} from "./necromancer.const";
import {
  getDefaultRuntime,
  getFallbackBlueprint,
} from "./necromancer.helpers";


export class NecromancerModule implements GameModule {
  public readonly id = "necromancer";

  private readonly bridge: DataBridge;
  private readonly playerUnits: PlayerUnitsModule;
  private readonly scene: SceneObjectManager;
  private readonly bonuses: BonusesModule;
  private readonly unitDesigns: UnitDesignModule;
  private readonly runState: MapRunState;

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
  private mapActive = false;
  private pendingLoad: ResourceAmountMap | null = null;
  private resourcesDirty = true;
  private cachedDesigns: UnitDesignerUnitState[] = [];
  private unsubscribeDesigns: (() => void) | null = null;
  private minSpawnManaCost: number = Number.POSITIVE_INFINITY;
  private sanityDepleted = false;

  constructor(options: NecromancerModuleOptions) {
    this.bridge = options.bridge;
    this.playerUnits = options.playerUnits;
    this.scene = options.scene;
    this.bonuses = options.bonuses;
    this.unitDesigns = options.unitDesigns;
    this.runState = options.runState;
    this.bonuses.subscribe((values) => {
      this.handleBonusValuesChanged(values);
    });
    this.unsubscribeDesigns = this.unitDesigns.subscribe(() => {
      this.cachedDesigns = this.unitDesigns.getActiveRosterDesigns();
      this.recomputeMinManaCost();
      this.pushSpawnOptions();
    });
  }

  public initialize(): void {
    this.applyCurrentBonusValues();
    this.cachedDesigns = this.unitDesigns.getActiveRosterDesigns();
    this.recomputeMinManaCost();
    this.pushSpawnOptions();
    this.pushResources();
  }

  public getResources(): NecromancerResourceSnapshot {
    return {
      mana: {
        current: this.mana.current,
        max: this.mana.max,
        regenPerSecond: this.mana.regenPerSecond,
      },
      sanity: {
        current: this.sanity.current,
        max: this.sanity.max,
      },
    };
  }

  public reset(): void {
    this.spawnPoints = [];
    this.nextSpawnIndex = 0;
    this.mapActive = false;
    this.pendingLoad = null;
    this.mana.current = 0;
    this.mana.max = 0;
    this.mana.regenPerSecond = 0;
    this.sanity.current = 0;
    this.sanity.max = 0;
    this.sanity.regenPerSecond = 0;
    this.sanityDepleted = false;
    this.markResourcesDirty();
    this.pushResources();
    this.pushSpawnOptions();
    this.minSpawnManaCost = Number.POSITIVE_INFINITY;
  }

  public load(data: unknown | undefined): void {
    this.pendingLoad = this.parseSaveData(data);
    this.sanityDepleted = false;
    this.markResourcesDirty();
    this.pushResources();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
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

    if (this.mapActive && this.sanity.current > -2) {
      const nextSanity = clampNumber(
        this.sanity.current - SANITY_DECAY_PER_SECOND * deltaSeconds,
        0,
        this.sanity.max
      );
      if (Math.abs(nextSanity - this.sanity.current) > SANITY_DEPLETION_THRESHOLD) {
        this.sanity.current = nextSanity;
        changed = true;
      }
    }

    this.checkSanityDepleted();

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
    this.mapActive = this.runState.isRunning();
    this.sanityDepleted = false;

    this.applyCurrentBonusValues();
    this.mana.current = this.mana.max;
    this.sanity.current = this.sanity.max;
    this.markResourcesDirty();

    this.applyPendingLoad();
    this.checkSanityDepleted();
    this.pushResources();
  }

  public trySpawnUnit(type: PlayerUnitType): boolean {
    if (!this.runState.shouldProcessTick() || !this.mapActive) {
      return false;
    }
    const design = this.unitDesigns.getDefaultDesignForType(type);
    if (design) {
      return this.trySpawnDesign(design.id);
    }
    if (!this.hasUnitCapacity()) {
      return false;
    }
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

  public trySpawnDesign(designId: UnitDesignId): boolean {
    if (!this.runState.shouldProcessTick() || !this.mapActive || !this.hasUnitCapacity()) {
      return false;
    }
    const design = this.cachedDesigns.find((entry) => entry.id === designId);
    if (!design) {
      return false;
    }
    if (!this.canAfford(design.cost)) {
      return false;
    }

    const spawnPosition = this.getNextSpawnPosition();
    const spawnData: PlayerUnitSpawnData = {
      designId: design.id,
      type: design.type,
      position: spawnPosition,
      runtimeModifiers: design.runtime,
      equippedModules: [...design.modules],
    };

    this.consumeResources(design.cost);
    this.playerUnits.spawnUnit(spawnData);
    this.markResourcesDirty();
    this.pushResources();
    return true;
  }

  public tryConsumeResources(cost: ResourceAmountMap): boolean {
    if (!this.runState.shouldProcessTick() || !this.mapActive) {
      return false;
    }
    const sanitized = this.sanitizeCost(cost);
    if (!this.canAfford(sanitized)) {
      return false;
    }

    this.consumeResources(sanitized);
    this.markResourcesDirty();
    this.pushResources();
    return true;
  }

  public isMapActive(): boolean {
    return this.mapActive && this.runState.shouldProcessTick();
  }

  public isSanityDepleted(): boolean {
    return this.sanityDepleted || this.sanity.current <= SANITY_DEPLETION_THRESHOLD;
  }

  public ensureMinMana(minAmount: number): void {
    if (this.mana.current < minAmount) {
      this.mana.current = Math.min(minAmount, this.mana.max);
      this.markResourcesDirty();
      this.pushResources();
    }
  }

  public getSpawnPoints(): SceneVector2[] {
    return this.spawnPoints.map((point) => ({ ...point }));
  }

  public getRemainingUnitCapacity(): number {
    return Math.max(0, MAX_UNITS_ON_MAP - this.playerUnits.getActiveUnitCount());
  }

  public getAffordableSpawnCount(): number {
    if (!this.runState.shouldProcessTick() || !this.mapActive) {
      return 0;
    }
    const remainingCapacity = this.getRemainingUnitCapacity();
    if (remainingCapacity <= 0) {
      return 0;
    }
    const minCost = this.minSpawnManaCost;
    if (!Number.isFinite(minCost) || minCost < 0) {
      return remainingCapacity;
    }
    if (minCost === 0) {
      return remainingCapacity;
    }
    return Math.max(0, Math.min(remainingCapacity, Math.floor(this.mana.current / minCost)));
  }

  private hasUnitCapacity(): boolean {
    return this.getRemainingUnitCapacity() > 0;
  }

  public endCurrentMap(): void {
    this.mapActive = false;
    this.spawnPoints = [];
    this.nextSpawnIndex = 0;
    this.pendingLoad = null;
    this.sanityDepleted = false;
    this.markResourcesDirty();
    this.pushResources();
  }

  public pauseMap(): void {
    this.mapActive = false;
    this.markResourcesDirty();
    this.pushResources();
  }

  public resumeMap(): void {
    if (this.runState.isCompleted()) {
      return;
    }
    this.mapActive = true;
    this.markResourcesDirty();
    this.pushResources();
  }

  private pushSpawnOptions(): void {
    const options: NecromancerSpawnOption[] = this.cachedDesigns.map((design) => ({
      designId: design.id,
      type: design.type,
      name: design.name,
      cost: design.cost,
      blueprint: design.blueprint,
      modules: design.moduleDetails,
      runtime: design.runtime,
    }));
    if (options.length === 0) {
      PLAYER_UNIT_TYPES.forEach((type) => {
        const config = getPlayerUnitConfig(type);
        options.push({
          designId: `${type}-default`,
          type,
          name: config.name,
          cost: normalizeResourceCost(config.cost),
          blueprint: getFallbackBlueprint(type, this.bonuses.getAllValues()),
          modules: [],
          runtime: getDefaultRuntime(),
        });
      });
    }
    DataBridgeHelpers.pushState(this.bridge, NECROMANCER_SPAWN_OPTIONS_BRIDGE_KEY, options);
  }

  private recomputeMinManaCost(): void {
    let min = Number.POSITIVE_INFINITY;
    if (this.cachedDesigns.length > 0) {
      for (let i = 0; i < this.cachedDesigns.length; i += 1) {
        const c = Math.max(0, this.cachedDesigns[i]!.cost.mana);
        if (c >= 0 && c < min) {
          min = c;
        }
      }
    } else {
      for (let i = 0; i < PLAYER_UNIT_TYPES.length; i += 1) {
        const type = PLAYER_UNIT_TYPES[i]!;
        const c = Math.max(0, normalizeResourceCost(getPlayerUnitConfig(type).cost).mana);
        if (c >= 0 && c < min) {
          min = c;
        }
      }
    }
    this.minSpawnManaCost = min;
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
  }

  private canAfford(cost: ResourceAmountMap): boolean {
    return this.mana.current >= cost.mana;
  }

  private applyCurrentBonusValues(): void {
    this.handleBonusValuesChanged(this.bonuses.getAllValues());
  }

  private handleBonusValuesChanged(values: BonusValueMap): void {
    const manaCap = sanitizeNumberWithFallback(values["mana_cap"], 0);
    const sanityCap = sanitizeNumberWithFallback(values["sanity_cap"], 0);
    const manaRegen = sanitizeNumberWithFallback(values["mana_regen"], 0);

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
    DataBridgeHelpers.pushState(this.bridge, NECROMANCER_RESOURCES_BRIDGE_KEY, payload);
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
      mana: sanitizeNumberWithFallback(mana),
      sanity: sanitizeNumberWithFallback(sanity),
    };
  }

  private markResourcesDirty(): void {
    this.resourcesDirty = true;
  }

  private sanitizeCost(cost: ResourceAmountMap): ResourceAmountMap {
    return {
      mana: Math.max(0, Number.isFinite(cost.mana) ? cost.mana : 0),
      sanity: 0,
    };
  }

  private checkSanityDepleted(): void {
    if (!this.mapActive || this.sanityDepleted) {
      return;
    }
    if (this.sanity.current <= SANITY_DEPLETION_THRESHOLD) {
      console.log("Sanity depleted");
      this.sanity.current = 0;
      this.markResourcesDirty();
      this.sanityDepleted = true;
      this.runState.complete(false);
    }
  }
}

