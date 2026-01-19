import { getUnitModuleConfig, UnitModuleId } from "../../../../../../db/unit-modules-db";
import {
  AbilityCandidate,
  AbilityDescription,
  AbilityEvaluationContext,
  AbilityExecutionContext,
  AbilityExecutionResult,
  AbilityStateBase,
} from "../ability.types";
import type { TargetSnapshot } from "../../../targeting/targeting.types";
import type { ArcTargetType } from "../../../../scene/arc/arc.types";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { subtractVectors, vectorHasLength } from "@/shared/helpers/vector.helper";

interface ChainLightningState extends AbilityStateBase {
  chainRadius: number;
  chainJumps: number;
  damagePercent: number;
}

interface ChainLightningTarget {
  id: string;
  type: "brick" | "enemy";
  position: SceneVector2;
}

const CHAIN_MODULE_ID = "conductorTentacles" satisfies UnitModuleId;
const DEFAULT_CHAIN_RADIUS = 160;
const DEFAULT_CHAIN_JUMPS = 2;

const computeDamagePercent = (level: number, moduleId: UnitModuleId): number => {
  const config = getUnitModuleConfig(moduleId);
  const base = Number.isFinite(config.baseBonusValue) ? config.baseBonusValue : 0;
  const perLevel = Number.isFinite(config.bonusPerLevel) ? config.bonusPerLevel : 0;
  return Math.max(base + perLevel * Math.max(level - 1, 0), 0);
};

const isChainTarget = (
  candidate: TargetSnapshot,
): candidate is TargetSnapshot<"brick" | "enemy"> =>
  candidate.type === "brick" || candidate.type === "enemy";

const evaluateChainLightning = (
  context: AbilityEvaluationContext<ChainLightningState>,
): AbilityCandidate<ChainLightningTarget> | null => {
  if (context.event !== "hit") {
    return null;
  }
  if (context.targetType !== "brick" || !context.targetId || !context.targetPosition) {
    return null;
  }

  const moduleLevel = context.unit.moduleLevels?.[CHAIN_MODULE_ID] ?? 0;
  if (moduleLevel <= 0) {
    return null;
  }

  if (
    context.state.chainRadius <= 0 ||
    context.state.chainJumps <= 0 ||
    context.state.damagePercent <= 0
  ) {
    return null;
  }

  const candidates = context.dependencies.getTargetsInRadius(
    context.targetPosition,
    context.state.chainRadius,
    ["brick", "enemy"],
  ).filter((candidate) => candidate.id !== context.targetId);
  if (candidates.length === 0) {
    return null;
  }

  return {
    score: 1.0,
    priority: 1,
    target: {
      id: context.targetId,
      type: "brick",
      position: context.targetPosition,
    },
  };
};

const executeChainLightning = (
  context: AbilityExecutionContext<ChainLightningState, ChainLightningTarget>,
): AbilityExecutionResult => {
  const { unit, state, dependencies, services, target } = context;
  if (target.type !== "brick") {
    return { success: false };
  }

  const chainDamage = Math.max(unit.baseAttackDamage, 0) * Math.max(state.damagePercent, 0);
  if (chainDamage <= 0 || state.chainRadius <= 0 || state.chainJumps <= 0) {
    return { success: false };
  }

  const getTargetsInRadius = dependencies.getTargetsInRadius;
  if (!getTargetsInRadius) {
    return { success: false };
  }

  let currentTarget = target;
  const visited = new Set<string>([`${target.type}:${target.id}`]);
  const applyDamageOptions = {
    rewardMultiplier: unit.rewardMultiplier,
    armorPenetration: unit.armorPenetration,
    skipKnockback: true,
  };

  for (let i = 0; i < state.chainJumps; i += 1) {
    const candidates = getTargetsInRadius(currentTarget.position, state.chainRadius, [
      "brick",
      "enemy",
    ]).filter((candidate): candidate is TargetSnapshot<"brick" | "enemy"> => {
      const key = `${candidate.type}:${candidate.id}`;
      return !visited.has(key) && isChainTarget(candidate);
    });

    if (candidates.length === 0) {
      break;
    }

    const nextCandidate = candidates[Math.floor(Math.random() * candidates.length)]!;
    const nextTarget: ChainLightningTarget = {
      id: nextCandidate.id,
      type: nextCandidate.type,
      position: nextCandidate.position,
    };
    const direction = subtractVectors(nextTarget.position, currentTarget.position);
    const damageOptions = {
      ...applyDamageOptions,
      direction: vectorHasLength(direction) ? direction : undefined,
    };

    if (dependencies.applyTargetDamage) {
      dependencies.applyTargetDamage(nextTarget.id, chainDamage, damageOptions);
    } else if (nextTarget.type === "brick") {
      dependencies.applyBrickDamage(nextTarget.id, chainDamage, damageOptions);
    }

    services.spawnArcBetweenTargets(
      "chainLightning",
      { type: currentTarget.type as ArcTargetType, id: currentTarget.id },
      { type: nextTarget.type as ArcTargetType, id: nextTarget.id },
      { persistOnDeath: true },
    );

    const key = `${nextTarget.type}:${nextTarget.id}`;
    visited.add(key);
    currentTarget = nextTarget;
  }

  return { success: true };
};

export const ChainLightningAbility: AbilityDescription<
  ChainLightningState,
  ChainLightningTarget
> = {
  abilityId: "chainLightning",
  requiredModules: [CHAIN_MODULE_ID],
  createState: (context) => {
    if (!context.hasModule(CHAIN_MODULE_ID)) {
      return null;
    }
    const level = context.unit.moduleLevels?.[CHAIN_MODULE_ID] ?? 0;
    if (level <= 0) {
      return null;
    }
    const meta = context.getModuleMeta(CHAIN_MODULE_ID);
    const chainRadius =
      typeof meta?.chainRadius === "number" && meta.chainRadius > 0
        ? meta.chainRadius
        : DEFAULT_CHAIN_RADIUS;
    const chainJumps =
      typeof meta?.chainJumps === "number" && meta.chainJumps > 0
        ? meta.chainJumps
        : DEFAULT_CHAIN_JUMPS;
    const damagePercent = computeDamagePercent(level, CHAIN_MODULE_ID);
    if (chainRadius <= 0 || chainJumps <= 0 || damagePercent <= 0) {
      return null;
    }
    return {
      state: {
        chainRadius,
        chainJumps,
        damagePercent,
      },
      cooldownSeconds: 0,
    };
  },
  evaluate: (context) => evaluateChainLightning(context),
  execute: (context) => executeChainLightning(context),
};
