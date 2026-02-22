import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DataBridge } from "@core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@core/logic/ui/DataBridgeHelpers";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import { readStoredGraphicsSettings } from "@logic/utils/graphicsSettings";
import type { BricksModule } from "../bricks/bricks.module";
import type { EnemiesModule } from "../enemies/enemies.module";
import type { PlayerUnitsModule } from "../player-units/player-units.module";
import { DAMAGE_TEXT_BRIDGE_KEY, DAMAGE_TEXT_TUNING } from "./damage-text.const";
import type { FloatingDamageTextBridgePayload, FloatingTextKind } from "./damage-text.types";
import type { TargetSnapshot, TargetType } from "./targeting.types";
import { TargetingService } from "./TargetingService";

export interface DamageApplicationOptions {
  readonly direction?: SceneVector2;
  readonly rewardMultiplier?: number;
  readonly armorPenetration?: number;
  readonly overTime?: number;
  readonly skipKnockback?: boolean;
  readonly knockBackDistance?: number;
  readonly knockBackSpeed?: number;
  readonly knockBackDirection?: SceneVector2;
  readonly payload?: DamagePayload;
  readonly isCritical?: boolean;
}

export interface AreaDamageOptions extends DamageApplicationOptions {
  readonly types?: readonly TargetType[];
  readonly explosionType?: string;
  readonly explosionRadius?: number;
  readonly excludeTargetIds?: readonly string[];
}

export interface DamageSource {
  readonly type: string;
  readonly id?: string;
}

export interface DamageContext {
  readonly source?: DamageSource;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly effectId?: string;
  readonly attackType?: string;
  readonly tag?: string;
  readonly seriesId?: string;
  readonly direction?: SceneVector2;
  readonly baseDamage?: number;
  readonly modifiers?: Record<string, number>;
}

export interface DamageAreaSpec {
  readonly radius?: number;
  readonly types?: readonly TargetType[];
}

export interface DamageExplosionSpec {
  readonly type?: string;
  readonly radius?: number;
}

export interface DamagePayload {
  readonly amount: number;
  readonly context?: DamageContext;
  readonly area?: DamageAreaSpec;
  readonly explosion?: DamageExplosionSpec;
}

interface DamageServiceOptions {
  readonly bridge?: DataBridge;
  readonly bricks: () => BricksModule;
  readonly enemies?: () => EnemiesModule;
  readonly units?: () => Pick<PlayerUnitsModule, "applyDamage" | "findNearestUnit">;
  readonly explosions?: ExplosionModule;
  readonly targeting: TargetingService;
}

export class DamageService {
  private readonly bridge?: DataBridge;
  private readonly bricks: DamageServiceOptions["bricks"];
  private readonly enemies?: DamageServiceOptions["enemies"];
  private readonly units?: DamageServiceOptions["units"];
  private readonly explosions?: DamageServiceOptions["explosions"];
  private readonly targeting: DamageServiceOptions["targeting"];
  private readonly damageTextPending = new Map<string, {
    position: SceneVector2;
    type: string;
    amount: number;
    isCritical: boolean;
    kind?: FloatingTextKind;
  }>();
  private damageTextRevision = 0;
  private lastDamageTextFlushMs = 0;
  private damageTextFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private cachedFloatingTextEnabled = true;
  private lastFloatingTextReadMs = -Infinity;

  constructor(options: DamageServiceOptions) {
    this.bridge = options.bridge;
    this.bricks = options.bricks;
    this.enemies = options.enemies;
    this.units = options.units;
    this.explosions = options.explosions;
    this.targeting = options.targeting;
  }

  public applyTargetDamage(
    targetId: string,
    damage: number,
    options: DamageApplicationOptions = {},
  ): number {
    const target = this.targeting.getTargetById(targetId);
    if (!target) {
      return 0;
    }
    return this.applyDamageSnapshot(target, damage, options);
  }

  public applyAreaDamage(
    position: SceneVector2,
    radius: number,
    damage: number,
    options: AreaDamageOptions = {},
  ): number {
    if (radius < 0) {
      return 0;
    }

    const payload = options.payload;
    const resolvedExplosionType = options.explosionType ?? payload?.explosion?.type;
    const resolvedExplosionRadius =
      options.explosionRadius ?? payload?.explosion?.radius ?? radius;
    if (resolvedExplosionType && this.explosions) {
      this.explosions.spawnExplosionByType(resolvedExplosionType as never, {
        position: { ...position },
        initialRadius: Math.max(1, resolvedExplosionRadius),
      });
    }

    if (damage <= 0) {
      return 0;
    }

    const targetTypes = options.types ?? payload?.area?.types;
    const filter = targetTypes?.length ? { types: targetTypes } : undefined;
    const excludedTargets = options.excludeTargetIds?.length
      ? new Set(options.excludeTargetIds)
      : null;
    let totalInflicted = 0;
    // console.log('POS: ', position, filter, radius, damage, options);
    this.targeting.forEachTargetNear(position, radius, (target) => {
      if (excludedTargets?.has(target.id)) {
        return;
      }
      totalInflicted += this.applyDamageSnapshot(target, damage, options);
    }, filter);
    return totalInflicted;
  }

  public queueHealText(position: SceneVector2, amount: number): void {
    this.queueCustomText("heal", position, amount, "unit", "heal");
  }

  public queueUnitDamageText(position: SceneVector2, amount: number): void {
    this.queueCustomText("unitDmg", position, amount, "unit", "damage");
  }

  private queueCustomText(
    prefix: string,
    position: SceneVector2,
    amount: number,
    targetType: string,
    kind: FloatingTextKind,
  ): void {
    if (!this.bridge || amount <= 0 || !this.isFloatingDamageTextEnabled()) {
      return;
    }
    const key = `${prefix}:${position.x.toFixed(0)},${position.y.toFixed(0)}`;
    const existing = this.damageTextPending.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      if (this.damageTextPending.size >= DAMAGE_TEXT_TUNING.maxConcurrentTexts) {
        return;
      }
      this.damageTextPending.set(key, {
        type: targetType,
        position: { ...position },
        amount,
        isCritical: false,
        kind,
      });
    }
    this.scheduleFlush();
  }

  private applyDamageSnapshot(
    target: TargetSnapshot,
    damage: number,
    options: DamageApplicationOptions,
  ): number {
    if (damage <= 0) {
      return 0;
    }

    const direction = options.direction ?? options.payload?.context?.direction;
    const isCritical = options.isCritical === true;
    if (target.type === "brick") {
      const result = this.bricks().applyDamage(target.id, damage, direction, {
        rewardMultiplier: options.rewardMultiplier,
        armorPenetration: options.armorPenetration,
        skipKnockback: options.skipKnockback,
        overTime: options.overTime,
      });
      this.queueDamageText(target, result.inflictedDamage, isCritical);
      return result.inflictedDamage;
    }

    const enemies = this.enemies?.();
    if (target.type === "enemy" && enemies) {
      const inflictedDamage = enemies.applyDamage(target.id, damage, {
        armorPenetration: options.armorPenetration,
        knockBackDirection: options.knockBackDirection,
        knockBackDistance: options.knockBackDistance,
        knockBackSpeed: options.knockBackSpeed,
        skipKnockback: options.skipKnockback,
        direction,
        rewardMultiplier: options.rewardMultiplier,
      });
      this.queueDamageText(target, inflictedDamage, isCritical);
      return inflictedDamage;
    }

    const units = this.units?.();
    if (target.type === "unit" && units) {
      const inflictedDamage = units.applyDamage(target.id, damage, {
        armorPenetration: options.armorPenetration,
        knockBackDistance: options.knockBackDistance,
        knockBackSpeed: options.knockBackSpeed,
        knockBackDirection: options.knockBackDirection,
      });
      this.queueDamageText(target, inflictedDamage, isCritical);
      return inflictedDamage;
    }

    return 0;
  }

  private queueDamageText(target: TargetSnapshot, inflictedDamage: number, isCritical: boolean): void {
    if (!this.bridge || inflictedDamage <= 0 || !this.isFloatingDamageTextEnabled()) {
      return;
    }

    const key = `${target.type}:${target.id}`;
    const existing = this.damageTextPending.get(key);
    if (existing) {
      existing.amount += inflictedDamage;
      if (isCritical) existing.isCritical = true;
    } else {
      if (this.damageTextPending.size >= DAMAGE_TEXT_TUNING.maxConcurrentTexts) {
        return;
      }
      this.damageTextPending.set(key, {
        position: { ...target.position },
        type: target.type,
        amount: inflictedDamage,
        isCritical,
      });
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    const now = performance.now();
    if (now - this.lastDamageTextFlushMs >= DAMAGE_TEXT_TUNING.aggregationWindowMs) {
      this.flushDamageTextQueue(now);
      return;
    }
    if (!this.damageTextFlushTimer) {
      this.damageTextFlushTimer = setTimeout(() => {
        this.damageTextFlushTimer = null;
        this.flushDamageTextQueue(performance.now());
      }, DAMAGE_TEXT_TUNING.aggregationWindowMs);
    }
  }

  private flushDamageTextQueue(now: number): void {
    if (!this.bridge || this.damageTextPending.size === 0) {
      return;
    }

    const events = [...this.damageTextPending.entries()].map(([key, entry]) => ({
      id: `${key}:${this.damageTextRevision}`,
      x: entry.position.x,
      y: entry.position.y,
      amount: entry.amount,
      targetType: entry.type,
      isCritical: entry.isCritical || undefined,
      kind: entry.kind,
    }));
    const payload: FloatingDamageTextBridgePayload = {
      revision: this.damageTextRevision + 1,
      events,
    };
    this.damageTextRevision += 1;
    this.lastDamageTextFlushMs = now;
    this.damageTextPending.clear();
    DataBridgeHelpers.pushState(this.bridge, DAMAGE_TEXT_BRIDGE_KEY, payload);
  }

  public clearFloatingTexts(): void {
    if (this.damageTextFlushTimer) {
      clearTimeout(this.damageTextFlushTimer);
      this.damageTextFlushTimer = null;
    }
    this.damageTextPending.clear();
    if (this.bridge) {
      const payload: FloatingDamageTextBridgePayload = {
        revision: this.damageTextRevision + 1,
        events: [],
        clear: true,
      };
      this.damageTextRevision += 1;
      DataBridgeHelpers.pushState(this.bridge, DAMAGE_TEXT_BRIDGE_KEY, payload);
    }
  }

  private isFloatingDamageTextEnabled(): boolean {
    const now = performance.now();
    if (now - this.lastFloatingTextReadMs < 300) {
      return this.cachedFloatingTextEnabled;
    }
    this.lastFloatingTextReadMs = now;
    this.cachedFloatingTextEnabled = readStoredGraphicsSettings().floatingDamageText;
    return this.cachedFloatingTextEnabled;
  }
}
