import type { BrickEffectTint } from "./BricksModule";

interface BrickEffectsDependencies {
  readonly hasBrick: (brickId: string) => boolean;
  readonly dealDamage: (
    brickId: string,
    amount: number,
    options: { rewardMultiplier: number; armorPenetration: number; overTime: number },
  ) => void;
  readonly setTint: (brickId: string, tint: BrickEffectTint | null) => void;
}

export const BURNING_TAIL_DURATION_MS = 4000;
export const FREEZING_TAIL_DURATION_MS = 4000;
export const BURNING_TAIL_DAMAGE_RATIO_PER_SECOND = 0.2;

const DAMAGE_APPLICATION_THRESHOLD = 0.5;

const EFFECT_TINTS: Partial<Record<BrickEffectType, BrickEffectTint & { priority: number }>> = {
  meltingTail: {
    color: { r: 1, g: 0.2, b: 0.1, a: 1 },
    intensity: 0.65,
    priority: 20,
  },
  freezingTail: {
    color: { r: 0.35, g: 0.55, b: 1, a: 1 },
    intensity: 0.55,
    priority: 10,
  },
  weakeningCurse: {
    color: { r: 0.55, g: 0.45, b: 0.95, a: 1 },
    intensity: 0.65,
    priority: 15,
  },
};

export type BrickEffectType = "meltingTail" | "freezingTail" | "weakeningCurse";

export type BrickEffectApplication =
  | {
      readonly type: "meltingTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly multiplier: number; // incoming damage multiplier (> 1)
      readonly tint?: BrickEffectTint | null;
    }
  | {
      readonly type: "freezingTail";
      readonly brickId: string;
      readonly durationMs: number;
      readonly divisor: number;
      readonly tint?: BrickEffectTint | null;
    }
  | {
      readonly type: "weakeningCurse";
      readonly brickId: string;
      readonly durationMs: number;
      readonly multiplier: number; // outgoing damage multiplier (< 1)
      readonly tint?: BrickEffectTint | null;
    };

interface BaseEffectState {
  readonly type: BrickEffectType;
  remainingMs: number;
  tint?: BrickEffectTint | null;
}

interface MeltingEffectState extends BaseEffectState {
  readonly type: "meltingTail";
  multiplier: number;
}

interface FreezingEffectState extends BaseEffectState {
  readonly type: "freezingTail";
  divisor: number;
}

interface WeakeningCurseEffectState extends BaseEffectState {
  readonly type: "weakeningCurse";
  multiplier: number;
}

type BrickEffectState = MeltingEffectState | FreezingEffectState | WeakeningCurseEffectState;

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

    if (effect.type === "meltingTail") {
      const normalizedMultiplier = Math.max(effect.multiplier, 1);
      const existing = bucket.find((entry): entry is MeltingEffectState => entry.type === "meltingTail");
      if (existing) {
        existing.remainingMs = effect.durationMs;
        if (normalizedMultiplier > existing.multiplier) {
          existing.multiplier = normalizedMultiplier;
        }
        existing.tint = effect.tint ?? existing.tint;
      } else {
        bucket.push({
          type: "meltingTail",
          remainingMs: effect.durationMs,
          multiplier: normalizedMultiplier,
          tint: effect.tint ?? null,
        });
      }
    } else if (effect.type === "freezingTail") {
      const normalizedDivisor = effect.divisor > 0 ? effect.divisor : 1;
      const existing = bucket.find((entry): entry is FreezingEffectState => entry.type === "freezingTail");
      if (existing) {
        existing.remainingMs = effect.durationMs;
        if (normalizedDivisor > existing.divisor) {
          existing.divisor = normalizedDivisor;
        }
        existing.tint = effect.tint ?? existing.tint;
      } else {
        bucket.push({
          type: "freezingTail",
          remainingMs: effect.durationMs,
          divisor: normalizedDivisor,
          tint: effect.tint ?? null,
        });
      }
    } else {
      const normalizedMultiplier = clampNumber(effect.multiplier, 0, 1);
      const existing = bucket.find(
        (entry): entry is WeakeningCurseEffectState => entry.type === "weakeningCurse",
      );
      if (existing) {
        existing.remainingMs = effect.durationMs;
        if (normalizedMultiplier < existing.multiplier) {
          existing.multiplier = normalizedMultiplier;
        }
        existing.tint = effect.tint ?? existing.tint;
      } else {
        bucket.push({
          type: "weakeningCurse",
          remainingMs: effect.durationMs,
          multiplier: normalizedMultiplier,
          tint: effect.tint ?? null,
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

        if (entry.type === "meltingTail") {
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
      } else if (entry.type === "weakeningCurse") {
        multiplier = Math.min(multiplier, Math.max(entry.multiplier, 0));
      }
    });
    return multiplier;
  }

  public getIncomingDamageMultiplier(brickId: string): number {
    const effects = this.effects.get(brickId);
    if (!effects || effects.length === 0) {
      return 1;
    }
    let multiplier = 1;
    effects.forEach((entry) => {
      if (entry.type === "meltingTail") {
        multiplier = Math.max(multiplier, Math.max(entry.multiplier, 1));
      }
    });
    return multiplier;
  }

  private resolveTint(effects: readonly BrickEffectState[]): BrickEffectTint | null {
    let selected: (BrickEffectTint & { priority: number }) | null = null;
    for (let i = 0; i < effects.length; i += 1) {
      const entry = effects[i]!;
      const defaultTint = EFFECT_TINTS[entry.type];
      const tint = entry.tint ?? defaultTint;
      if (!tint) {
        continue;
      }
      if (!selected || (defaultTint?.priority ?? 0) > selected.priority) {
        selected = {
          color: { ...tint.color },
          intensity: tint.intensity,
          priority: defaultTint?.priority ?? 0,
        };
      }
    }
    if (!selected) {
      return null;
    }
    return { color: { ...selected.color }, intensity: selected.intensity };
  }
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};

