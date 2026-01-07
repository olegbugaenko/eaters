import type { VisualEffectId, VisualEffectOverlayConfig } from "./effects-db";
import type { BrickEffectTint } from "@/logic/modules/active-map/bricks/bricks.types";
import { EFFECT_TINTS } from "@/logic/modules/active-map/bricks/brick-effects.const";

export type StatusEffectId =
  | "frenzy"
  | "internalFurnace"
  | "meltingTail"
  | "freezingTail"
  | "weakeningCurse"
  | "weakeningCurseFlat"
  | "poison"
  | "burn"
  | "freeze"
  | "cracks";

export type StatusEffectTargetType = "unit" | "enemy" | "brick";

export type StatusEffectKind =
  | "attackBonusCharges"
  | "stackingAttackBonus"
  | "incomingDamageMultiplier"
  | "outgoingDamageMultiplier"
  | "outgoingDamageFlatReduction"
  | "damageOverTime"
  | "speedMultiplier"
  | "armorReductionStacks";

export interface StatusEffectVisuals {
  readonly overlay?: VisualEffectOverlayConfig;
  readonly auraEffectId?: VisualEffectId;
  readonly brickTint?: BrickEffectTint;
  readonly brickTintPriority?: number;
  readonly stackIntensity?: {
    readonly mode: "linear" | "sqrt";
    readonly maxIntensity: number;
  };
}

export interface StatusEffectConfigBase {
  readonly id: StatusEffectId;
  readonly kind: StatusEffectKind;
  readonly target: StatusEffectTargetType | "any";
  readonly durationMs?: number;
  readonly tickIntervalMs?: number;
  readonly maxStacks?: number;
  readonly visuals?: StatusEffectVisuals;
}

export type StatusEffectConfig = StatusEffectConfigBase;

const INTERNAL_FURNACE_COLOR = {
  r: 0.98,
  g: 0.35,
  b: 0.32,
  a: 1,
};

const STATUS_EFFECTS_DB: Record<StatusEffectId, StatusEffectConfig> = {
  frenzy: {
    id: "frenzy",
    kind: "attackBonusCharges",
    target: "unit",
    visuals: {
      auraEffectId: "frenzyAura",
    },
  },
  internalFurnace: {
    id: "internalFurnace",
    kind: "stackingAttackBonus",
    target: "unit",
    visuals: {
      overlay: {
        color: INTERNAL_FURNACE_COLOR,
        intensity: 0.75,
        priority: 50,
        target: "fill",
      },
      stackIntensity: {
        mode: "sqrt",
        maxIntensity: 0.75,
      },
    },
  },
  meltingTail: {
    id: "meltingTail",
    kind: "incomingDamageMultiplier",
    target: "brick",
    visuals: {
      brickTint: EFFECT_TINTS.meltingTail,
      brickTintPriority: EFFECT_TINTS.meltingTail?.priority ?? 0,
    },
  },
  freezingTail: {
    id: "freezingTail",
    kind: "outgoingDamageMultiplier",
    target: "brick",
    visuals: {
      brickTint: EFFECT_TINTS.freezingTail,
      brickTintPriority: EFFECT_TINTS.freezingTail?.priority ?? 0,
    },
  },
  weakeningCurse: {
    id: "weakeningCurse",
    kind: "outgoingDamageMultiplier",
    target: "brick",
    visuals: {
      brickTint: EFFECT_TINTS.weakeningCurse,
      brickTintPriority: EFFECT_TINTS.weakeningCurse?.priority ?? 0,
    },
  },
  weakeningCurseFlat: {
    id: "weakeningCurseFlat",
    kind: "outgoingDamageFlatReduction",
    target: "brick",
    visuals: {
      brickTint: EFFECT_TINTS.weakeningCurseFlat,
      brickTintPriority: EFFECT_TINTS.weakeningCurseFlat?.priority ?? 0,
    },
  },
  poison: {
    id: "poison",
    kind: "damageOverTime",
    target: "any",
    durationMs: 6000,
    tickIntervalMs: 1000,
    visuals: {
      overlay: {
        color: { r: 0.25, g: 0.85, b: 0.3, a: 1 },
        intensity: 0.4,
        priority: 12,
        target: "fill",
      },
    },
  },
  burn: {
    id: "burn",
    kind: "damageOverTime",
    target: "any",
    durationMs: 4000,
    tickIntervalMs: 500,
    visuals: {
      overlay: {
        color: { r: 1, g: 0.4, b: 0.2, a: 1 },
        intensity: 0.5,
        priority: 14,
        target: "fill",
      },
    },
  },
  freeze: {
    id: "freeze",
    kind: "speedMultiplier",
    target: "any",
    durationMs: 4000,
    visuals: {
      overlay: {
        color: { r: 0.45, g: 0.75, b: 1, a: 1 },
        intensity: 0.5,
        priority: 13,
        target: "fill",
      },
    },
  },
  cracks: {
    id: "cracks",
    kind: "armorReductionStacks",
    target: "any",
    maxStacks: 5,
    visuals: {
      overlay: {
        color: { r: 0.85, g: 0.35, b: 0.25, a: 1 },
        intensity: 0.45,
        priority: 16,
        target: "stroke",
      },
    },
  },
};

export const getStatusEffectConfig = (id: StatusEffectId): StatusEffectConfig => {
  const config = STATUS_EFFECTS_DB[id];
  if (!config) {
    throw new Error(`Unknown status effect id: ${id}`);
  }
  return config;
};
