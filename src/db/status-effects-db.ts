import type { VisualEffectId, VisualEffectOverlayConfig } from "./effects-db";
import type { BrickEffectTint } from "@/logic/modules/active-map/bricks/bricks.types";
import { EFFECT_TINTS } from "@/logic/modules/active-map/bricks/brick-effects.const";
import type { ParticleEmitterConfig } from "@/logic/interfaces/visuals/particle-emitters-config";
import { FILL_TYPES } from "@/core/logic/provided/services/scene-object-manager/scene-object-manager.const";

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
  | "cracks"
  | "bleeding";

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
  readonly unitEmitters?: StatusEffectUnitEmitterConfig;
  readonly stackIntensity?: {
    readonly mode: "linear" | "sqrt";
    readonly maxIntensity: number;
  };
}

export interface StatusEffectUnitEmitterConfig {
  readonly emitters: readonly ParticleEmitterConfig[];
  readonly offsetScale?: "absolute" | "unit";
}

/**
 * Describes a parameter that can be displayed in effect tooltip.
 * Used for both "potential effects" (what enemy can apply) and "active effects" (what's on target).
 */
export type EffectDescriptionParam =
  | { readonly type: "damage"; readonly label: string }              // damagePerSecond -> "X/s"
  | { readonly type: "duration"; readonly label: string }            // durationMs -> "Xs"
  | { readonly type: "slowdown"; readonly label: string }            // speedMultiplier -> "X%"
  | { readonly type: "stacks"; readonly label: string }              // maxStacks -> "up to X"
  | { readonly type: "armorReduction"; readonly label: string }      // armorReductionPerStack
  | { readonly type: "incomingDamageBonus"; readonly label: string } // incomingDamageMultiplier -> "+X%"
  | { readonly type: "outgoingDamageReduction"; readonly label: string }; // outgoingDamageMultiplier -> "-X%"

export interface StatusEffectConfigBase {
  readonly id: StatusEffectId;
  readonly kind: StatusEffectKind;
  readonly target: StatusEffectTargetType | "any";
  readonly displayName: string;
  readonly descriptionParams?: readonly EffectDescriptionParam[];
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

const BLEEDING_EMITTER_BASE: ParticleEmitterConfig = {
  particlesPerSecond: 1800,
  particleLifetimeMs: 950,
  fadeStartMs: 400,
  sizeRange: { min: 2.2, max: 4.2 },
  color: { r: 0.78, g: 0.32, b: 0.36, a: 0.9 },
  baseSpeed: 0.1,
  speedVariation: 0.01,
  spread: Math.PI * 0.65,
  spawnRadius: { min: 0, max: 2.5 },
  shape: "triangle",
  maxParticles: 1200,
};

const POISON_EMITTER_BASE: ParticleEmitterConfig = {
  particlesPerSecond: 200,
  particleLifetimeMs: 900,
  fadeStartMs: 250,
  sizeRange: { min: 2.4, max: 19.1 },
  color: { r: 0.3, g: 0.9, b: 0.35, a: 0.3 },
  fill: {
    fillType: FILL_TYPES.RADIAL_GRADIENT,
    start: { x: 0, y: 0 },
    stops: [
      { offset: 0, color: { r: 0.5, g: 0.9, b: 0.35, a: 0.1 } },
      { offset: 1, color: { r: 0.5, g: 0.9, b: 0.35, a: 0.0 } },
    ],
  },
  baseSpeed: 0.02,
  speedVariation: 0.01,
  spread: Math.PI,
  spawnRadius: { min: 0, max: 3.5 },
  shape: "circle",
  maxParticles: 1000,
};

const STATUS_EFFECTS_DB: Record<StatusEffectId, StatusEffectConfig> = {
  frenzy: {
    id: "frenzy",
    kind: "attackBonusCharges",
    target: "unit",
    displayName: "Frenzy",
    visuals: {
      auraEffectId: "frenzyAura",
    },
  },
  internalFurnace: {
    id: "internalFurnace",
    kind: "stackingAttackBonus",
    target: "unit",
    displayName: "Internal Furnace",
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
    displayName: "Melting Tail",
    descriptionParams: [
      { type: "incomingDamageBonus", label: "Damage Bonus" },
      { type: "duration", label: "Duration" },
    ],
    visuals: {
      brickTint: EFFECT_TINTS.meltingTail,
      brickTintPriority: EFFECT_TINTS.meltingTail?.priority ?? 0,
    },
  },
  freezingTail: {
    id: "freezingTail",
    kind: "outgoingDamageMultiplier",
    target: "brick",
    displayName: "Freezing Tail",
    descriptionParams: [
      { type: "outgoingDamageReduction", label: "Damage Reduction" },
      { type: "duration", label: "Duration" },
    ],
    visuals: {
      brickTint: EFFECT_TINTS.freezingTail,
      brickTintPriority: EFFECT_TINTS.freezingTail?.priority ?? 0,
    },
  },
  weakeningCurse: {
    id: "weakeningCurse",
    kind: "outgoingDamageMultiplier",
    target: "brick",
    displayName: "Weakening Curse",
    visuals: {
      brickTint: EFFECT_TINTS.weakeningCurse,
      brickTintPriority: EFFECT_TINTS.weakeningCurse?.priority ?? 0,
    },
  },
  weakeningCurseFlat: {
    id: "weakeningCurseFlat",
    kind: "outgoingDamageFlatReduction",
    target: "brick",
    displayName: "Weakening Curse",
    visuals: {
      brickTint: EFFECT_TINTS.weakeningCurseFlat,
      brickTintPriority: EFFECT_TINTS.weakeningCurseFlat?.priority ?? 0,
    },
  },
  poison: {
    id: "poison",
    kind: "damageOverTime",
    target: "any",
    displayName: "Poison",
    descriptionParams: [
      { type: "damage", label: "Poison Damage" },
      { type: "duration", label: "Duration" },
    ],
    durationMs: 6000,
    tickIntervalMs: 1000,
    visuals: {
      overlay: {
        color: { r: 0.25, g: 0.85, b: 0.3, a: 1 },
        intensity: 0.4,
        priority: 12,
        target: "fill",
      },
      unitEmitters: {
        offsetScale: "unit",
        emitters: [
          {
            ...POISON_EMITTER_BASE,
            offset: { x: 0, y: -0.65 },
            direction: -Math.PI / 2,
          },
          {
            ...POISON_EMITTER_BASE,
            offset: { x: 0.35, y: 0.5 },
            direction: Math.PI / 3,
          },
          {
            ...POISON_EMITTER_BASE,
            offset: { x: -0.35, y: 0.5 },
            direction: (Math.PI * 2) / 3,
          },
        ],
      },
    },
  },
  burn: {
    id: "burn",
    kind: "damageOverTime",
    target: "any",
    displayName: "Burn",
    descriptionParams: [
      { type: "damage", label: "Burn Damage" },
      { type: "duration", label: "Duration" },
    ],
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
    displayName: "Freeze",
    descriptionParams: [
      { type: "slowdown", label: "Slowdown" },
      { type: "duration", label: "Duration" },
    ],
    durationMs: 4000,
    visuals: {
      overlay: {
        color: { r: 0.15, g: 0.25, b: 0.95, a: 1 },
        intensity: 0.5,
        priority: 13,
        target: ["fill", "stroke"],
      },
    },
  },
  cracks: {
    id: "cracks",
    kind: "armorReductionStacks",
    target: "any",
    displayName: "Cracks",
    descriptionParams: [
      { type: "armorReduction", label: "Armor Reduction" },
      { type: "stacks", label: "Max Stacks" },
    ],
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
  bleeding: {
    id: "bleeding",
    kind: "damageOverTime",
    target: "unit",
    displayName: "Bleeding",
    descriptionParams: [
      { type: "damage", label: "Bleed Damage" },
      { type: "duration", label: "Duration" },
      { type: "stacks", label: "Max Stacks" },
    ],
    durationMs: 4000,
    tickIntervalMs: 1000,
    maxStacks: 4,
    visuals: {
      overlay: {
        color: { r: 0.9, g: 0.2, b: 0.2, a: 1 },
        intensity: 0.45,
        priority: 12,
        target: "fill",
      },
      unitEmitters: {
        offsetScale: "unit",
        emitters: [
          {
            ...BLEEDING_EMITTER_BASE,
            offset: { x: 0, y: -0.5 },
            direction: -Math.PI / 2, // perpendicular left from movement
          },
          {
            ...BLEEDING_EMITTER_BASE,
            offset: { x: 0, y: 0.5 },
            direction: Math.PI / 2, // perpendicular right from movement
          },
        ],
      },
    },
  },
};

export const STATUS_EFFECT_OVERLAY_IDS: StatusEffectId[] = Object.values(
  STATUS_EFFECTS_DB
)
  .filter((config) => Boolean(config.visuals?.overlay))
  .map((config) => config.id);

export const STATUS_EFFECT_UNIT_EMITTER_IDS: StatusEffectId[] = Object.values(
  STATUS_EFFECTS_DB
)
  .filter((config) => Boolean(config.visuals?.unitEmitters))
  .map((config) => config.id);

export const getStatusEffectConfig = (id: StatusEffectId): StatusEffectConfig => {
  const config = STATUS_EFFECTS_DB[id];
  if (!config) {
    throw new Error(`Unknown status effect id: ${id}`);
  }
  return config;
};
