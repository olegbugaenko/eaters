import { GameModule } from "@core/logic/types";
import {
  StatusEffectId,
  StatusEffectConfig,
  StatusEffectVisuals,
  getStatusEffectConfig,
} from "../../../../db/status-effects-db";
import type {
  StatusEffectApplicationOptions,
  StatusEffectTarget,
  StatusEffectUnitAdapter,
  StatusEffectBrickAdapter,
  StatusEffectEnemyAdapter,
} from "./status-effects.types";

interface StatusEffectInstance {
  readonly id: StatusEffectId;
  readonly target: StatusEffectTarget;
  remainingMs?: number;
  stacks: number;
  data: Record<string, number>;
  nextTickMs: number;
  visuals?: StatusEffectVisuals;
}

type BrickTint = {
  color: { r: number; g: number; b: number; a?: number };
  intensity: number;
};

type TargetKey = `${StatusEffectTarget["type"]}:${string}`;

const getTargetKey = (target: StatusEffectTarget): TargetKey =>
  `${target.type}:${target.id}`;

const clampPositive = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return value;
};

export class StatusEffectsModule implements GameModule {
  public readonly id = "statusEffects";

  private readonly effectsByTarget = new Map<
    TargetKey,
    Map<StatusEffectId, StatusEffectInstance[]>
  >();
  private unitAdapter: StatusEffectUnitAdapter | null = null;
  private brickAdapter: StatusEffectBrickAdapter | null = null;
  private enemyAdapter: StatusEffectEnemyAdapter | null = null;

  public registerUnitAdapter(adapter: StatusEffectUnitAdapter): void {
    this.unitAdapter = adapter;
  }

  public registerBrickAdapter(adapter: StatusEffectBrickAdapter): void {
    this.brickAdapter = adapter;
  }

  public registerEnemyAdapter(adapter: StatusEffectEnemyAdapter): void {
    this.enemyAdapter = adapter;
  }

  public initialize(): void {}

  public reset(): void {
    this.clearAllEffects();
  }

  public load(_data: unknown | undefined): void {
    this.clearAllEffects();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.effectsByTarget.size === 0) {
      return;
    }

    const expiredTargets: TargetKey[] = [];

    this.effectsByTarget.forEach((effectsMap, targetKey) => {
      let visualsDirty = false;
      effectsMap.forEach((instances, effectId) => {
        const config = getStatusEffectConfig(effectId);
        const survivors: StatusEffectInstance[] = [];

        instances.forEach((instance) => {
          if (instance.remainingMs !== undefined) {
            instance.remainingMs = Math.max(instance.remainingMs - deltaMs, 0);
            // console.log('ticking: ', instance.id, instance.remainingMs, effectId);
          }

          if (this.shouldTickInstance(instance, config)) {
            this.tickInstance(instance, config, deltaMs);
          }

          const expired = instance.remainingMs !== undefined && instance.remainingMs <= 0;
          if (!expired) {
            survivors.push(instance);
          } else {
            visualsDirty = true;
          }
        });

        if (survivors.length > 0) {
          effectsMap.set(effectId, survivors);
        } else {
          effectsMap.delete(effectId);
          visualsDirty = true;
        }
      });

      if (effectsMap.size === 0) {
        expiredTargets.push(targetKey);
      }

      if (visualsDirty) {
        this.refreshVisualsForTarget(targetKey);
      }
    });

    expiredTargets.forEach((targetKey) => {
      this.effectsByTarget.delete(targetKey);
    });
  }

  public applyEffect(
    effectId: StatusEffectId,
    target: StatusEffectTarget,
    options: StatusEffectApplicationOptions = {},
  ): void {
    const config = getStatusEffectConfig(effectId);
    if (config.target !== "any" && config.target !== target.type) {
      return;
    }
    if (target.type === "brick" && this.brickAdapter && !this.brickAdapter.hasBrick(target.id)) {
      return;
    }
    if (target.type === "enemy" && this.enemyAdapter && !this.enemyAdapter.hasEnemy(target.id)) {
      return;
    }

    const targetKey = getTargetKey(target);
    const effectsMap =
      this.effectsByTarget.get(targetKey) ?? new Map<StatusEffectId, StatusEffectInstance[]>();
    const instances = effectsMap.get(effectId) ?? [];

    const nextDuration = this.resolveDuration(config, options);
    const instance = this.resolveInstance(config, target, instances, options, nextDuration);
    if (!instance) {
      return;
    }

    effectsMap.set(effectId, instances);
    this.effectsByTarget.set(targetKey, effectsMap);


    this.refreshVisualsForTarget(targetKey);
  }

  public removeEffect(effectId: StatusEffectId, target: StatusEffectTarget): void {
    const targetKey = getTargetKey(target);
    const effectsMap = this.effectsByTarget.get(targetKey);
    if (!effectsMap || !effectsMap.has(effectId)) {
      return;
    }
    effectsMap.delete(effectId);
    if (effectsMap.size === 0) {
      this.effectsByTarget.delete(targetKey);
    }
    this.refreshVisualsForTarget(targetKey);
  }

  public clearTargetEffects(target: StatusEffectTarget): void {
    const targetKey = getTargetKey(target);
    const effectsMap = this.effectsByTarget.get(targetKey);
    if (!effectsMap) {
      return;
    }
    this.effectsByTarget.delete(targetKey);
    this.refreshVisualsForTarget(targetKey, { clearAll: true, effectsMap });
  }

  public clearAllEffects(): void {
    this.effectsByTarget.forEach((effectsMap, targetKey) => {
      this.refreshVisualsForTarget(targetKey, { clearAll: true, effectsMap });
    });
    this.effectsByTarget.clear();
  }

  public hasEffect(effectId: StatusEffectId, target: StatusEffectTarget): boolean {
    const targetKey = getTargetKey(target);
    const effectsMap = this.effectsByTarget.get(targetKey);
    if (!effectsMap) {
      return false;
    }
    const instances = effectsMap.get(effectId);
    return Boolean(instances && instances.length > 0);
  }

  public consumeAttackBonus(unitId: string): number {
    const targetKey = getTargetKey({ type: "unit", id: unitId });
    const effectsMap = this.effectsByTarget.get(targetKey);
    if (!effectsMap) {
      return 0;
    }
    const instances = effectsMap.get("frenzy");
    if (!instances || instances.length === 0) {
      return 0;
    }

    let total = 0;
    const survivors: StatusEffectInstance[] = [];

    instances.forEach((instance) => {
      const charges = Math.max(instance.data.charges ?? 0, 0);
      const bonusDamage = Math.max(instance.data.bonusDamage ?? 0, 0);
      if (charges <= 0 || bonusDamage <= 0) {
        return;
      }
      total += bonusDamage;
      const next = charges - 1;
      if (next > 0) {
        instance.data.charges = next;
        survivors.push(instance);
      }
    });

    if (survivors.length > 0) {
      effectsMap.set("frenzy", survivors);
    } else {
      effectsMap.delete("frenzy");
      if (effectsMap.size === 0) {
        this.effectsByTarget.delete(targetKey);
      }
    }

    this.refreshVisualsForTarget(targetKey);
    return total;
  }

  public getUnitAttackMultiplier(unitId: string): number {
    const instances = this.getInstancesForTarget("internalFurnace", {
      type: "unit",
      id: unitId,
    });
    if (!instances || instances.length === 0) {
      return 1;
    }
    const instance = instances[0]!;
    const cap = Math.max(instance.data.cap ?? 0, 0);
    const stackValue = Math.min(Math.max(instance.stacks, 0), cap);
    return 1 + stackValue;
  }

  public handleUnitAttack(unitId: string): void {
    const instances = this.getInstancesForTarget("internalFurnace", {
      type: "unit",
      id: unitId,
    });
    if (!instances || instances.length === 0) {
      return;
    }
    const instance = instances[0]!;
    const perHit = Math.max(instance.data.perHitBonus ?? 0, 0);
    const cap = Math.max(instance.data.cap ?? 0, 0);
    if (perHit <= 0 || cap <= 0) {
      return;
    }
    const next = Math.min(instance.stacks + perHit, cap);
    if (next !== instance.stacks) {
      instance.stacks = next;
      this.refreshVisualsForTarget(getTargetKey(instance.target));
    }
  }

  public getBrickIncomingDamageMultiplier(brickId: string): number {
    const instances = this.getInstancesForTarget("meltingTail", {
      type: "brick",
      id: brickId,
    });
    if (!instances || instances.length === 0) {
      return 1;
    }
    let multiplier = 1;
    instances.forEach((instance) => {
      const value = Math.max(instance.data.multiplier ?? 1, 1);
      multiplier = Math.max(multiplier, value);
    });
    return multiplier;
  }

  public getBrickOutgoingDamageMultiplier(brickId: string): number {
    const freezing = this.getInstancesForTarget("freezingTail", { type: "brick", id: brickId });
    const weakening = this.getInstancesForTarget("weakeningCurse", { type: "brick", id: brickId });
    let multiplier = 1;
    [freezing, weakening].forEach((instances) => {
      if (!instances || instances.length === 0) {
        return;
      }
      instances.forEach((instance) => {
        const value = Math.max(instance.data.multiplier ?? 1, 0);
        multiplier = Math.min(multiplier, value);
      });
    });
    return multiplier;
  }

  public getBrickOutgoingDamageFlatReduction(brickId: string): number {
    const instances = this.getInstancesForTarget("weakeningCurseFlat", {
      type: "brick",
      id: brickId,
    });
    if (!instances || instances.length === 0) {
      return 0;
    }
    let reduction = 0;
    instances.forEach((instance) => {
      reduction = Math.max(reduction, Math.max(instance.data.flatReduction ?? 0, 0));
    });
    return reduction;
  }

  public getTargetArmorDelta(target: StatusEffectTarget): number {
    const instances = this.getInstancesForTarget("cracks", target);
    if (!instances || instances.length === 0) {
      return 0;
    }
    let reduction = 0;
    instances.forEach((instance) => {
      const perStack = Math.max(instance.data.armorReductionPerStack ?? 0, 0);
      reduction += perStack * Math.max(instance.stacks, 0);
    });
    return -reduction;
  }

  public getTargetSpeedMultiplier(target: StatusEffectTarget): number {
    const instances = this.getInstancesForTarget("freeze", target);
    if (!instances || instances.length === 0) {
      return 1;
    }
    let multiplier = 1;
    instances.forEach((instance) => {
      const value = Math.max(instance.data.speedMultiplier ?? 1, 0);
      multiplier = Math.min(multiplier, value);
    });
    return multiplier;
  }

  public handleTargetHit(target: StatusEffectTarget): void {
    const instances = this.getInstancesForTarget("cracks", target);
    if (!instances || instances.length === 0) {
      return;
    }
    let updated = false;
    instances.forEach((instance) => {
      if (instance.stacks > 0) {
        instance.stacks = Math.max(instance.stacks - 1, 0);
        updated = true;
      }
    });

    if (updated) {
      const targetKey = getTargetKey(target);
      const effectsMap = this.effectsByTarget.get(targetKey);
      if (effectsMap) {
        const survivors = instances.filter((instance) => instance.stacks > 0);
        if (survivors.length > 0) {
          effectsMap.set("cracks", survivors);
        } else {
          effectsMap.delete("cracks");
        }
        if (effectsMap.size === 0) {
          this.effectsByTarget.delete(targetKey);
        }
      }
      this.refreshVisualsForTarget(getTargetKey(target));
    }
  }

  public ensureInternalFurnace(
    unitId: string,
    perHitBonus: number,
    cap: number,
  ): void {
    if (perHitBonus <= 0 || cap <= 0) {
      return;
    }
    this.applyEffect(
      "internalFurnace",
      { type: "unit", id: unitId },
      { perHitBonus, cap },
    );
  }

  private shouldTickInstance(instance: StatusEffectInstance, config: StatusEffectConfig): boolean {
    if (config.kind !== "damageOverTime") {
      return false;
    }
    if (instance.remainingMs !== undefined && instance.remainingMs <= 0) {
      return false;
    }
    const interval = config.tickIntervalMs ?? 0;
    if (interval <= 0) {
      return false;
    }
    return true;
  }

  private tickInstance(
    instance: StatusEffectInstance,
    config: StatusEffectConfig,
    deltaMs: number,
  ): void {
    const interval = config.tickIntervalMs ?? 0;
    if (interval <= 0) {
      return;
    }
    instance.nextTickMs = Math.max(instance.nextTickMs - deltaMs, 0);
    if (instance.nextTickMs > 0) {
      return;
    }
    instance.nextTickMs = interval;
    const damagePerTick = Math.max(instance.data.damagePerTick ?? 0, 0);
    if (damagePerTick <= 0) {
      return;
    }
    this.applyDamage(instance.target, damagePerTick);
  }

  private resolveDuration(
    config: StatusEffectConfig,
    options: StatusEffectApplicationOptions,
  ): number | undefined {
    if (typeof options.durationMs === "number") {
      return Math.max(options.durationMs, 0);
    }
    if (typeof config.durationMs === "number") {
      return Math.max(config.durationMs, 0);
    }
    return undefined;
  }

  private resolveInstance(
    config: StatusEffectConfig,
    target: StatusEffectTarget,
    instances: StatusEffectInstance[],
    options: StatusEffectApplicationOptions,
    durationMs: number | undefined,
  ): StatusEffectInstance | null {
    const visuals = config.visuals;
    if (config.kind === "attackBonusCharges") {
      const charges = Math.max(options.charges ?? 0, 0);
      const bonusDamage = Math.max(options.bonusDamage ?? 0, 0);
      if (charges <= 0 || bonusDamage <= 0) {
        return null;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs,
        stacks: 1,
        data: {
          charges,
          bonusDamage,
        },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals,
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "stackingAttackBonus") {
      const perHitBonus = Math.max(options.perHitBonus ?? 0, 0);
      const cap = Math.max(options.cap ?? 0, 0);
      if (perHitBonus <= 0 || cap <= 0) {
        return null;
      }
      const existing = instances[0];
      if (existing) {
        existing.data.perHitBonus = perHitBonus;
        existing.data.cap = cap;
        existing.remainingMs = durationMs ?? existing.remainingMs;
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs,
        stacks: 0,
        data: {
          perHitBonus,
          cap,
        },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals,
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "incomingDamageMultiplier") {
      const multiplier = Math.max(options.multiplier ?? 1, 1);
      const existing = instances[0];
      if (existing) {
        existing.remainingMs = durationMs ?? existing.remainingMs;
        existing.data.multiplier = Math.max(existing.data.multiplier ?? 1, multiplier);
        existing.visuals = this.mergeTintVisuals(visuals, options);
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs,
        stacks: 1,
        data: { multiplier },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals: this.mergeTintVisuals(visuals, options),
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "outgoingDamageMultiplier") {
      const multiplier = options.multiplier ?? (options.divisor ? 1 / options.divisor : 1);
      const normalized = clampPositive(multiplier) || 1;
      const existing = instances[0];
      if (existing) {
        existing.remainingMs = durationMs ?? existing.remainingMs;
        existing.data.multiplier = Math.min(existing.data.multiplier ?? 1, normalized);
        existing.visuals = this.mergeTintVisuals(visuals, options);
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs,
        stacks: 1,
        data: { multiplier: normalized },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals: this.mergeTintVisuals(visuals, options),
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "outgoingDamageFlatReduction") {
      const flatReduction = Math.max(options.flatReduction ?? 0, 0);
      if (flatReduction <= 0) {
        return null;
      }
      const existing = instances[0];
      if (existing) {
        existing.remainingMs = durationMs ?? existing.remainingMs;
        existing.data.flatReduction = Math.max(existing.data.flatReduction ?? 0, flatReduction);
        existing.visuals = this.mergeTintVisuals(visuals, options);
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs,
        stacks: 1,
        data: { flatReduction },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals: this.mergeTintVisuals(visuals, options),
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "damageOverTime") {
      const interval = Math.max(config.tickIntervalMs ?? 0, 0);
      const damagePerTick =
        Math.max(options.damagePerTick ?? 0, 0) ||
        Math.max((options.damagePerSecond ?? 0) * (interval / 1000), 0);
      if (damagePerTick <= 0) {
        return null;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs ?? config.durationMs,
        stacks: 1,
        data: { damagePerTick },
        nextTickMs: interval,
        visuals,
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "speedMultiplier") {
      const speedMultiplier = Math.max(options.speedMultiplier ?? 0, 0);
      if (speedMultiplier <= 0) {
        return null;
      }
      const existing = instances[0];
      if (existing) {
        // Always refresh duration when effect is reapplied
        existing.remainingMs = durationMs ?? config.durationMs ?? existing.remainingMs;
        existing.data.speedMultiplier = Math.min(existing.data.speedMultiplier ?? 1, speedMultiplier);
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs ?? config.durationMs,
        stacks: 1,
        data: { speedMultiplier },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals,
      };
      instances.push(instance);
      return instance;
    }

    if (config.kind === "armorReductionStacks") {
      const armorReductionPerStack = Math.max(options.armorReductionPerStack ?? 0, 0);
      if (armorReductionPerStack <= 0) {
        return null;
      }
      const existing = instances[0];
      const maxStacks = Math.max(config.maxStacks ?? 0, 0);
      const nextStacks = Math.max(options.stacks ?? 1, 1);
      if (existing) {
        existing.remainingMs = durationMs ?? existing.remainingMs;
        existing.data.armorReductionPerStack = armorReductionPerStack;
        existing.stacks = maxStacks > 0 ? Math.min(existing.stacks + nextStacks, maxStacks) : existing.stacks + nextStacks;
        return existing;
      }
      const instance: StatusEffectInstance = {
        id: config.id,
        target,
        remainingMs: durationMs ?? config.durationMs,
        stacks: maxStacks > 0 ? Math.min(nextStacks, maxStacks) : nextStacks,
        data: { armorReductionPerStack },
        nextTickMs: config.tickIntervalMs ?? 0,
        visuals,
      };
      instances.push(instance);
      return instance;
    }

    return null;
  }

  private applyDamage(target: StatusEffectTarget, amount: number): void {
    if (amount <= 0) {
      return;
    }
    if (target.type === "unit" && this.unitAdapter) {
      this.unitAdapter.damageUnit(target.id, amount);
    } else if (target.type === "brick" && this.brickAdapter) {
      this.brickAdapter.damageBrick(target.id, amount, {
        rewardMultiplier: 1,
        armorPenetration: 0,
        overTime: 1,
      });
    } else if (target.type === "enemy" && this.enemyAdapter) {
      this.enemyAdapter.damageEnemy(target.id, amount);
    }
  }

  private refreshVisualsForTarget(
    targetKey: TargetKey,
    options?: { clearAll?: boolean; effectsMap?: Map<StatusEffectId, StatusEffectInstance[]> },
  ): void {
    const effectsMap = options?.effectsMap ?? this.effectsByTarget.get(targetKey);
    const [type, id] = targetKey.split(":") as [StatusEffectTarget["type"], string];

    if (type === "unit") {
      const unitAdapter = this.unitAdapter;
      if (!unitAdapter) {
        return;
      }
      if (!unitAdapter.hasUnit(id)) {
        this.effectsByTarget.delete(targetKey);
        return;
      }
      const applyOverlay = (effectId: string, overlay: StatusEffectVisuals["overlay"] | null) => {
        if (!overlay) {
          unitAdapter.applyOverlay(id, effectId, "fill", null);
          unitAdapter.applyOverlay(id, effectId, "stroke", null);
          return;
        }
        const targets = Array.isArray(overlay.target)
          ? overlay.target
          : [overlay.target ?? "fill"];
        // Clear targets not in the list
        if (!targets.includes("fill")) {
          unitAdapter.applyOverlay(id, effectId, "fill", null);
        }
        if (!targets.includes("stroke")) {
          unitAdapter.applyOverlay(id, effectId, "stroke", null);
        }
        // Apply to specified targets
        targets.forEach((target) => {
          unitAdapter.applyOverlay(id, effectId, target, overlay);
        });
      };

      if (options?.clearAll || !effectsMap) {
        unitAdapter.applyOverlay(id, "internalFurnace", "fill", null);
        unitAdapter.applyOverlay(id, "internalFurnace", "stroke", null);
        unitAdapter.removeAura(id, "frenzyAura");
        effectsMap?.forEach((_instances, effectId) => {
          unitAdapter.applyOverlay(id, effectId, "fill", null);
          unitAdapter.applyOverlay(id, effectId, "stroke", null);
        });
        return;
      }

      const frenzyInstances = effectsMap.get("frenzy") ?? [];
      if (frenzyInstances.length > 0) {
        unitAdapter.applyAura(id, "frenzyAura");
      } else {
        unitAdapter.removeAura(id, "frenzyAura");
      }

      const furnaceInstances = effectsMap.get("internalFurnace");
      if (furnaceInstances && furnaceInstances.length > 0) {
        const instance = furnaceInstances[0]!;
        const overlay = this.resolveOverlayFromStacks(instance);
        applyOverlay("internalFurnace", overlay);
      } else {
        applyOverlay("internalFurnace", null);
      }

      effectsMap.forEach((instances, effectId) => {
        if (effectId === "frenzy" || effectId === "internalFurnace") {
          return;
        }
        const instance = instances[0];
        const visual = instance?.visuals?.overlay ?? null;
        applyOverlay(effectId, visual ?? null);
      });
    } else if (type === "brick") {
      if (!this.brickAdapter) {
        return;
      }
      if (options?.clearAll || !effectsMap) {
        this.brickAdapter.setTint(id, null);
        return;
      }
      this.brickAdapter.setTint(id, this.resolveBrickTint(effectsMap));
    }
  }

  private resolveOverlayFromStacks(instance: StatusEffectInstance): StatusEffectVisuals["overlay"] | null {
    const overlay = instance.visuals?.overlay;
    if (!overlay) {
      return null;
    }
    const cap = Math.max(instance.data.cap ?? 0, 0);
    if (cap <= 0) {
      return overlay;
    }
    const ratio = Math.min(Math.max(instance.stacks, 0) / cap, 1);
    const intensityConfig = instance.visuals?.stackIntensity;
    if (!intensityConfig) {
      return overlay;
    }
    const normalized =
      intensityConfig.mode === "sqrt" ? Math.sqrt(ratio) : ratio;
    return {
      ...overlay,
      intensity: Math.min(normalized * intensityConfig.maxIntensity, intensityConfig.maxIntensity),
    };
  }

  private resolveBrickTint(
    effectsMap: Map<StatusEffectId, StatusEffectInstance[]>,
  ): BrickTint | null {
    let selectedTint: BrickTint | null = null;
    let selectedPriority = Number.NEGATIVE_INFINITY;

    effectsMap.forEach((instances) => {
      instances.forEach((instance) => {
        const tint = instance.visuals?.brickTint;
        const priority = instance.visuals?.brickTintPriority ?? 0;
        if (!tint) {
          return;
        }
        if (!selectedTint || priority > selectedPriority) {
          selectedTint = {
            color: { ...tint.color },
            intensity: tint.intensity,
          };
          selectedPriority = priority;
        }
      });
    });

    if (!selectedTint) {
      return null;
    }
    const resolvedTint = selectedTint as BrickTint;
    return { color: { ...resolvedTint.color }, intensity: resolvedTint.intensity };
  }

  private mergeTintVisuals(
    visuals: StatusEffectVisuals | undefined,
    options: StatusEffectApplicationOptions,
  ): StatusEffectVisuals | undefined {
    if (!options.tint && !options.tintPriority) {
      return visuals;
    }
    return {
      ...visuals,
      brickTint: options.tint ?? visuals?.brickTint,
      brickTintPriority: options.tintPriority ?? visuals?.brickTintPriority,
    };
  }

  private getInstancesForTarget(
    effectId: StatusEffectId,
    target: StatusEffectTarget,
  ): StatusEffectInstance[] | null {
    const targetKey = getTargetKey(target);
    const effectsMap = this.effectsByTarget.get(targetKey);
    if (!effectsMap) {
      return null;
    }
    const instances = effectsMap.get(effectId);
    return instances ?? null;
  }
}
