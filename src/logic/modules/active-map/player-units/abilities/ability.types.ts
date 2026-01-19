import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { SkillId } from "../../../../../db/skills-db";
import type { UnitModuleConfig, UnitModuleId } from "../../../../../db/unit-modules-db";
import type { PlayerUnitAbilityState } from "./AbilityUnitState";
import type { AbilityVisualService } from "./AbilityVisualService";
import type { UnitProjectileController } from "../../projectiles/ProjectileController"; 
import type { StatusEffectsModule } from "../../status-effects/status-effects.module";
import type { TargetSnapshot, TargetType } from "../../targeting/targeting.types";
import type { DamageApplicationOptions } from "../../targeting/DamageService";

export type AbilitySoundId = "heal" | "frenzy" | "fireball" | "tailNeedle" | "chainLightning";

export interface AbilityStateBase {
  chargesRemaining?: number;
  chargesTotal?: number;
}

export interface AbilityCooldownState {
  key: string;
  duration: number;
  remaining: number;
}

export interface AbilityInitializationContext {
  unit: PlayerUnitAbilityState;
  hasModule: (moduleId: UnitModuleId) => boolean;
  hasSkill: (skillId: SkillId) => boolean;
  getModuleMeta: (moduleId: UnitModuleId) => UnitModuleConfig["meta"] | undefined;
}

export interface AbilityInitializationResult<State extends AbilityStateBase> {
  state: State;
  cooldownSeconds: number;
  sharedCooldownKey?: string;
}

export interface AbilityRuntimeDependencies {
  readonly logEvent: (message: string) => void;
  readonly formatUnitLabel: (unit: PlayerUnitAbilityState) => string;
  readonly getUnits: () => readonly PlayerUnitAbilityState[];
  readonly getUnitById: (id: string) => PlayerUnitAbilityState | undefined;
  readonly getBrickPosition: (brickId: string) => SceneVector2 | null;
  readonly damageBrick: (brickId: string, damage: number) => void;
  readonly applyBrickDamage: (
    brickId: string,
    damage: number,
    options?: DamageApplicationOptions,
  ) => number;
  readonly applyTargetDamage?: (
    targetId: string,
    damage: number,
    options?: DamageApplicationOptions,
  ) => number;
  readonly getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  readonly getTargetsInRadius: (
    position: SceneVector2,
    radius: number,
    types?: readonly TargetType[],
  ) => TargetSnapshot[];
  readonly damageUnit: (unitId: string, damage: number) => void;
  readonly findNearestBrick: (position: SceneVector2) => string | null;
  readonly projectiles?: UnitProjectileController;
  readonly statusEffects: StatusEffectsModule;
}

export interface AbilityCooldownInfo {
  readonly remaining: number;
  readonly duration: number;
}

export interface AbilityEvaluationContext<State extends AbilityStateBase> {
  unit: PlayerUnitAbilityState;
  state: State;
  cooldown: AbilityCooldownInfo;
  services: AbilityVisualService;
  dependencies: AbilityRuntimeDependencies;
  event?: "tick" | "hit";
  attackDirection?: SceneVector2;
  inflictedDamage?: number;
  totalDamage?: number;
  targetType?: TargetType;
  targetId?: string;
  targetPosition?: SceneVector2;
}

export interface AbilityCandidate<TTarget> {
  score: number;
  priority?: number;
  target: TTarget;
}

export interface AbilityExecutionContext<State extends AbilityStateBase, TTarget>
  extends AbilityEvaluationContext<State> {
  target: TTarget;
}

export interface AbilityExecutionResult {
  success: boolean;
  soundId?: AbilitySoundId;
  statsChanged?: boolean;
}

export interface AbilityDescription<State extends AbilityStateBase = AbilityStateBase, TTarget = unknown> {
  abilityId: AbilitySoundId;
  requiredModules?: readonly UnitModuleId[];
  requiredSkills?: readonly SkillId[];
  sharedCooldownKey?: string;
  createState(context: AbilityInitializationContext): AbilityInitializationResult<State> | null;
  evaluate(context: AbilityEvaluationContext<State>): AbilityCandidate<TTarget> | null;
  execute(context: AbilityExecutionContext<State, TTarget>): AbilityExecutionResult;
}
