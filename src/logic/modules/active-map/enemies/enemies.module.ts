import { DataBridgeHelpers } from "../../../core/DataBridgeHelpers";
import type { DataBridge } from "../../../core/DataBridge";
import { GameModule } from "../../../core/types";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { clampNumber } from "@shared/helpers/numbers.helper";
import { cloneResourceStockpile, normalizeResourceAmount } from "../../../../db/resources-db";
import { SpatialGrid } from "../../../utils/SpatialGrid";
import { MapRunState } from "../map/MapRunState";
import type { TargetingService } from "../targeting/TargetingService";
import { DamageService } from "../targeting/DamageService";
import { EnemyStateFactory, EnemyStateInput } from "./enemies.state-factory";
import {
  ENEMY_COUNT_BRIDGE_KEY,
  ENEMY_SCENE_OBJECT_TYPE,
  ENEMY_SPATIAL_GRID_CELL_SIZE,
  ENEMY_TOTAL_HP_BRIDGE_KEY,
} from "./enemies.const";
import type {
  EnemiesModuleOptions,
  EnemyRuntimeState,
  EnemySaveData,
  EnemySpawnData,
  InternalEnemyState,
} from "./enemies.types";
import { EnemyTargetingProvider } from "./enemies.targeting-provider";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import { vectorLength } from "../../../../shared/helpers/vector.helper";

export class EnemiesModule implements GameModule {
  public readonly id = "enemies";

  private readonly scene: EnemiesModuleOptions["scene"];
  private readonly bridge: DataBridge;
  private readonly runState: MapRunState;
  private readonly targeting?: TargetingService;
  private readonly damage?: DamageService;
  private readonly explosions?: ExplosionModule;
  private readonly stateFactory: EnemyStateFactory;
  private readonly spatialIndex = new SpatialGrid<InternalEnemyState>(ENEMY_SPATIAL_GRID_CELL_SIZE);

  private enemies = new Map<string, InternalEnemyState>();
  private enemyOrder: InternalEnemyState[] = [];
  private enemyIdCounter = 0;
  private totalHpCached = 0;
  private lastPushedCount = -1;
  private lastPushedTotalHp = -1;

  constructor(options: EnemiesModuleOptions) {
    this.scene = options.scene;
    this.bridge = options.bridge;
    this.runState = options.runState;
    this.targeting = options.targeting;
    this.damage = options.damage;
    this.explosions = options.explosions;
    this.stateFactory = new EnemyStateFactory({ scene: this.scene });

    if (this.targeting) {
      this.targeting.registerProvider(new EnemyTargetingProvider(this));
    }
  }

  public initialize(): void {
    this.pushStats();
  }

  public reset(): void {
    this.setEnemies([]);
  }

  public load(data: unknown | undefined): void {
    const parsed = this.parseSaveData(data);
    if (parsed?.enemies) {
      this.applyEnemies(parsed.enemies);
      return;
    }
    this.pushStats();
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
    let anyChanged = false;

    this.enemyOrder.forEach((enemy) => {
      if (enemy.attackCooldown > 0) {
        const next = Math.max(enemy.attackCooldown - deltaSeconds, 0);
        if (next !== enemy.attackCooldown) {
          enemy.attackCooldown = next;
          anyChanged = true;
        }
      }

      if (enemy.attackCooldown <= 0 && this.tryAttack(enemy)) {
        enemy.attackCooldown = enemy.attackInterval;
        anyChanged = true;
      }
    });

    if (anyChanged) {
      this.pushStats();
    }
  }

  public setEnemies(enemies: EnemySpawnData[]): void {
    this.applyEnemies(enemies);
  }

  public getEnemies(): EnemyRuntimeState[] {
    return this.enemyOrder.map((enemy) => this.cloneState(enemy));
  }

  public getEnemyState(id: string): EnemyRuntimeState | null {
    const enemy = this.enemies.get(id);
    return enemy ? this.cloneState(enemy) : null;
  }

  public findNearestEnemy(position: SceneVector2): EnemyRuntimeState | null {
    const nearest = this.spatialIndex.queryNearest(position, { maxLayers: 128 });
    return nearest ? this.cloneState(nearest) : null;
  }

  public findEnemiesNear(position: SceneVector2, radius: number): EnemyRuntimeState[] {
    if (radius < 0) {
      return [];
    }
    return this.spatialIndex
      .queryCircle(position, radius)
      .map((enemy) => this.cloneState(enemy));
  }

  public forEachEnemyNear(
    position: SceneVector2,
    radius: number,
    visitor: (enemy: EnemyRuntimeState) => void,
  ): void {
    if (radius < 0) {
      return;
    }
    this.spatialIndex.forEachInCircle(position, radius, (enemy) => visitor(this.cloneState(enemy)));
  }

  public applyDamage(enemyId: string, damage: number, options?: { armorPenetration?: number }): number {
    if (damage <= 0) {
      return 0;
    }
    const enemy = this.enemies.get(enemyId);
    if (!enemy) {
      return 0;
    }
    const armorPenetration = clampNumber(options?.armorPenetration ?? 0, 0, Number.POSITIVE_INFINITY);
    const effectiveArmor = Math.max(enemy.armor - armorPenetration, 0);
    const appliedDamage = Math.max(damage - effectiveArmor, 0);
    if (appliedDamage <= 0) {
      return 0;
    }

    const remainingHp = Math.max(enemy.hp - appliedDamage, 0);
    const dealt = enemy.hp - remainingHp;
    enemy.hp = remainingHp;
    this.totalHpCached = Math.max(0, this.totalHpCached - dealt);

    if (enemy.hp <= 0) {
      this.destroyEnemy(enemy);
    }

    this.pushStats();
    return dealt;
  }

  private applyEnemies(enemies: EnemySpawnData[]): void {
    this.clearSceneObjects();
    this.enemyIdCounter = 0;
    this.totalHpCached = 0;
    this.lastPushedCount = -1;
    this.lastPushedTotalHp = -1;

    enemies.forEach((enemy) => {
      const input: EnemyStateInput = {
        enemy,
        enemyId: this.createEnemyId(enemy.id),
        clampToMap: (position: EnemySpawnData["position"]) => this.clampToMap(position),
      };
      const state = this.stateFactory.createWithTransform(input);
      this.enemies.set(state.id, state);
      this.enemyOrder.push(state);
      this.spatialIndex.set(state.id, state.position, state.physicalSize, state);
      this.totalHpCached += state.hp;
    });

    this.pushStats();
  }

  private createEnemyId(preferred: string | undefined): string {
    if (preferred && !this.enemies.has(preferred)) {
      return preferred;
    }
    this.enemyIdCounter += 1;
    return `${ENEMY_SCENE_OBJECT_TYPE}-${this.enemyIdCounter}`;
  }

  private destroyEnemy(enemy: InternalEnemyState): void {
    this.scene.removeObject(enemy.sceneObjectId);
    this.enemies.delete(enemy.id);
    this.enemyOrder = this.enemyOrder.filter((item) => item.id !== enemy.id);
    this.spatialIndex.delete(enemy.id);
  }

  private tryAttack(enemy: InternalEnemyState): boolean {
    if (!this.damage || !this.targeting) {
      return false;
    }

    const target = this.targeting.findNearestTarget(enemy.position, { types: ["unit"] });
    if (!target) {
      return false;
    }

    const distance = vectorLength({
      x: target.position.x - enemy.position.x,
      y: target.position.y - enemy.position.y,
    });
    if (distance > enemy.attackRange) {
      return false;
    }

    this.damage.applyTargetDamage(target.id, enemy.baseDamage, {
      armorPenetration: 0,
    });

    if (this.explosions) {
      this.explosions.spawnExplosionByType("plasmoid", {
        position: { ...target.position },
        initialRadius: Math.max(8, enemy.physicalSize),
      });
    }

    return true;
  }

  private clearSceneObjects(): void {
    this.enemyOrder.forEach((enemy) => {
      this.scene.removeObject(enemy.sceneObjectId);
    });
    this.enemies.clear();
    this.enemyOrder = [];
    this.spatialIndex.clear();
  }

  private parseSaveData(data: unknown): EnemySaveData | null {
    if (!data || typeof data !== "object") {
      return null;
    }
    const { enemies } = data as Partial<EnemySaveData>;
    if (!Array.isArray(enemies)) {
      return null;
    }
    return { enemies };
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }

  private pushStats(): void {
    const count = this.enemies.size;
    if (count !== this.lastPushedCount) {
      DataBridgeHelpers.pushState(this.bridge, ENEMY_COUNT_BRIDGE_KEY, count);
      this.lastPushedCount = count;
    }

    const totalHp = Math.max(0, Math.floor(this.totalHpCached));
    if (totalHp !== this.lastPushedTotalHp) {
      DataBridgeHelpers.pushState(this.bridge, ENEMY_TOTAL_HP_BRIDGE_KEY, totalHp);
      this.lastPushedTotalHp = totalHp;
    }
  }

  private cloneState(enemy: InternalEnemyState): EnemyRuntimeState {
    return {
      id: enemy.id,
      type: enemy.type,
      position: { ...enemy.position },
      rotation: enemy.rotation,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      armor: enemy.armor,
      baseDamage: enemy.baseDamage,
      attackInterval: enemy.attackInterval,
      attackCooldown: enemy.attackCooldown,
      attackRange: enemy.attackRange,
      moveSpeed: enemy.moveSpeed,
      physicalSize: enemy.physicalSize,
      reward: enemy.reward ? cloneResourceStockpile(normalizeResourceAmount(enemy.reward)) : undefined,
    };
  }
}
