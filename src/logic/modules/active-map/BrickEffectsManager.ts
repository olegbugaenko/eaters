import type { BrickEffectTint } from "./BricksModule";

interface BrickEffectsDependencies {
  readonly hasBrick: (brickId: string) => boolean;
  readonly dealDamage: (
    brickId: string,
    amount: number,
    options: { rewardMultiplier: number; armorPenetration: number },
  ) => void;
  readonly setTint: (brickId: string, tint: BrickEffectTint | null) => void;
}

export const BURNING_TAIL_DURATION_MS = 4000;
export const FREEZING_TAIL_DURATION_MS = 4000;
export const BURNING_TAIL_DAMAGE_RATIO_PER_SECOND = 0.2;

const DAMAGE_APPLICATION_THRESHOLD = 0.5;

const EFFECT_TINTS: Record<BrickEffectType, BrickEffectTint & { priority: number }> = {
  burningTail: {
    color: { r: 1, g: 0.2, b: 0.1, a: 1 },
    intensity: 0.65,
    priority: 20,
  },
  freezingTail: {
    color: { r: 0.35, g: 0.55, b: 1, a: 1 },
    intensity: 0.55,
    priority: 10,
  },
};

export type BrickEffectType = "burningTail" | "freezingTail";

export type BrickEffectApplication =
  | {
      readonly type: "burningTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly damagePerSecond: number;
      readonly rewardMultiplier: number;
      readonly armorPenetration: number;
    }
  | {
      readonly type: "freezingTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly divisor: number;
    };

interface BurningEffectState {
  readonly type: "burningTail";
  remainingMs: number;
  pendingDamage: number;
  damagePerSecond: number;
  readonly rewardMultiplier: number;
  readonly armorPenetration: number;
}

interface FreezingEffectState {
  readonly type: "freezingTail";
  remainingMs: number;
  divisor: number;
}

type BrickEffectState = BurningEffectState | FreezingEffectState;

export class BrickEffectsManager {
  private readonly dependencies: BrickEffectsDependencies;
  private readonly effects = new Map<string, BrickEffectState[]>();
  private readonly activeBricks = new Set<string>();

  constructor(dependencies: BrickEffectsDependencies) {
    this.dependencies = dependencies;
  }

  public clearAllEffects(): void {
    if (this.effects.size === 0) {
      return;
    }
    this.effects.clear();
    this.activeBricks.clear();
  }

  public clearEffects(brickId: string): void {
    if (!this.effects.has(brickId)) {
      return;
    }
    this.effects.delete(brickId);
    this.activeBricks.delete(brickId);
    this.dependencies.setTint(brickId, null);
  }

  public applyEffect(effect: BrickEffectApplication): void {
    if (!this.dependencies.hasBrick(effect.brickId)) {
      return;
    }
    if (effect.durationMs <= 0) {
      return;
    }

    const bucket = this.effects.get(effect.brickId) ?? [];

    if (effect.type === "burningTail") {
      if (effect.damagePerSecond <= 0) {
        if (bucket.length === 0) {
          return;
        }
      } else {
        bucket.push({
          type: "burningTail",
          remainingMs: effect.durationMs,
          pendingDamage: 0,
          damagePerSecond: effect.damagePerSecond,
          rewardMultiplier: Math.max(effect.rewardMultiplier, 0),
          armorPenetration: Math.max(effect.armorPenetration, 0),
        });
      }
    } else {
      const normalizedDivisor = effect.divisor > 0 ? effect.divisor : 1;
      const existing = bucket.find((entry): entry is FreezingEffectState => entry.type === "freezingTail");
      if (existing) {
        existing.remainingMs = effect.durationMs;
        if (normalizedDivisor > existing.divisor) {
          existing.divisor = normalizedDivisor;
        }
      } else {
        bucket.push({
          type: "freezingTail",
          remainingMs: effect.durationMs,
          divisor: normalizedDivisor,
        });
      }
    }

    if (bucket.length === 0) {
      return;
    }

    this.effects.set(effect.brickId, bucket);
    this.activeBricks.add(effect.brickId);
    this.dependencies.setTint(effect.brickId, this.resolveTint(bucket));
  }

  public update(deltaMs: number): void {
    if (deltaMs <= 0 || this.activeBricks.size === 0) {
      return;
    }

    const expired: string[] = [];
    const deltaSeconds = deltaMs / 1000;

    this.activeBricks.forEach((brickId) => {
      if (!this.dependencies.hasBrick(brickId)) {
        expired.push(brickId);
        return;
      }

      const effects = this.effects.get(brickId);
      if (!effects || effects.length === 0) {
        expired.push(brickId);
        return;
      }

      const survivors: BrickEffectState[] = [];
      let tintChanged = false;

      for (let i = 0; i < effects.length; i += 1) {
        const entry = effects[i]!;
        entry.remainingMs = Math.max(entry.remainingMs - deltaMs, 0);

        if (entry.type === "burningTail") {
          entry.pendingDamage += entry.damagePerSecond * deltaSeconds;

          if (entry.pendingDamage >= DAMAGE_APPLICATION_THRESHOLD || entry.remainingMs <= 0) {
            const damage = entry.pendingDamage;
            if (damage > 0) {
              this.dependencies.dealDamage(brickId, damage, {
                rewardMultiplier: entry.rewardMultiplier,
                armorPenetration: entry.armorPenetration,
              });
            }
            entry.pendingDamage = 0;
          }

          if (entry.remainingMs > 0) {
            survivors.push(entry);
          } else {
            tintChanged = true;
          }
        } else {
          if (entry.remainingMs > 0) {
            survivors.push(entry);
          } else {
            tintChanged = true;
          }
        }
      }

      if (survivors.length === 0) {
        expired.push(brickId);
        return;
      }

      this.effects.set(brickId, survivors);
      if (tintChanged) {
        this.dependencies.setTint(brickId, this.resolveTint(survivors));
      }
    });

    if (expired.length > 0) {
      expired.forEach((brickId) => {
        this.activeBricks.delete(brickId);
        this.effects.delete(brickId);
        this.dependencies.setTint(brickId, null);
      });
    }
  }

  public getOutgoingDamageMultiplier(brickId: string): number {
    const effects = this.effects.get(brickId);
    if (!effects || effects.length === 0) {
      return 1;
    }
    let multiplier = 1;
    effects.forEach((entry) => {
      if (entry.type === "freezingTail") {
        const reduction = 1 / Math.max(entry.divisor, 1);
        multiplier = Math.min(multiplier, reduction);
      }
    });
    return multiplier;
  }

  private resolveTint(effects: readonly BrickEffectState[]): BrickEffectTint | null {
    let selected: (BrickEffectTint & { priority: number }) | null = null;
    for (let i = 0; i < effects.length; i += 1) {
      const entry = effects[i]!;
      const tint = EFFECT_TINTS[entry.type];
      if (!tint) {
        continue;
      }
      if (!selected || tint.priority > selected.priority) {
        selected = tint;
      }
    }
    if (!selected) {
      return null;
    }
    return { color: { ...selected.color }, intensity: selected.intensity };
  }
}

