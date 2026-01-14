import { UnitModuleId } from "../../../../../../db/unit-modules-db";
import {
  DEFAULT_MENDING_HEALS_PER_RUN,
  DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS,
  HEAL_SKIP_RATIO_THRESHOLD,
  PHEROMONE_HEAL_EXPLOSION_RADIUS,
} from "../ability.const";
import { clampNumber } from "@shared/helpers/numbers.helper";
import {
  AbilityCandidate,
  AbilityDescription,
  AbilityEvaluationContext,
  AbilityExecutionContext,
  AbilityExecutionResult,
  AbilityInitializationContext,
  AbilityStateBase,
} from "../ability.types";
import type { PlayerUnitAbilityState } from "../AbilityUnitState";

interface PheromoneHealState extends AbilityStateBase {
  chargesRemaining: number;
  chargesTotal: number;
}

const MENDING_MODULE_ID = "mendingGland" satisfies UnitModuleId;

const computeHealScore = (
  source: PlayerUnitAbilityState,
  target: PlayerUnitAbilityState,
  healAmount: number,
): number => {
  const missingHp = Math.max(target.maxHp - target.hp, 0);
  const ratio = target.maxHp > 0 ? missingHp / target.maxHp : 0;
  if (target.maxHp > 0) {
    const currentRatio = target.hp / target.maxHp;
    if (
      currentRatio > HEAL_SKIP_RATIO_THRESHOLD &&
      missingHp > 0 &&
      missingHp < healAmount
    ) {
      return 0;
    }
  }
  const amp = healAmount > 0 ? Math.min(missingHp / (healAmount * 0.75), 1) : 0;
  const score = Math.max(0, Math.min(1, Math.pow(ratio, 0.5) * Math.max(amp, 0.2)));
  return score;
};

const findHealingTarget = (
  source: PlayerUnitAbilityState,
  units: readonly PlayerUnitAbilityState[],
): PlayerUnitAbilityState | null => {
  let best: PlayerUnitAbilityState | null = null;
  let bestRatio = Number.POSITIVE_INFINITY;
  units.forEach((candidate) => {
    if (candidate.id === source.id || candidate.hp <= 0 || candidate.maxHp <= 0) {
      return;
    }
    const ratio = candidate.hp / candidate.maxHp;
    if (ratio >= 1) {
      return;
    }
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  });
  return best;
};

const evaluateHealCandidate = (
  context: AbilityEvaluationContext<PheromoneHealState>,
): AbilityCandidate<PlayerUnitAbilityState> | null => {
  const { unit, dependencies } = context;
  const target = findHealingTarget(unit, dependencies.getUnits());
  if (!target) {
    return null;
  }
  const healAmount =
    Math.max(unit.baseAttackDamage, 0) * Math.max(unit.pheromoneHealingMultiplier, 0);
  if (healAmount <= 0) {
    return null;
  }
  const score = computeHealScore(unit, target, healAmount);
  if (score <= 0) {
    return null;
  }
  return { score, priority: 0, target };
};

const executeHeal = (
  context: AbilityExecutionContext<PheromoneHealState, PlayerUnitAbilityState>,
): AbilityExecutionResult => {
  const { unit, target, services, dependencies } = context;
  const healAmount =
    Math.max(unit.baseAttackDamage, 0) * Math.max(unit.pheromoneHealingMultiplier, 0);
  if (healAmount <= 0) {
    return { success: false };
  }
  const previousHp = target.hp;
  const nextHp = clampNumber(previousHp + healAmount, 0, target.maxHp);
  if (nextHp <= previousHp) {
    return { success: false };
  }
  target.hp = nextHp;
  const healedAmount = nextHp - previousHp;

  services.spawnExplosionByType("healWave", {
    position: { ...target.position },
    initialRadius: PHEROMONE_HEAL_EXPLOSION_RADIUS,
  });
  services.spawnArcBetweenUnits("heal", unit, target);

  const multiplier = Math.max(unit.pheromoneHealingMultiplier, 0);
  const attackPower = Math.max(unit.baseAttackDamage, 0);
  dependencies.logEvent(
    `${dependencies.formatUnitLabel(unit)} healed ${dependencies.formatUnitLabel(target)} for ${healedAmount.toFixed(
      1,
    )} HP (${previousHp.toFixed(1)} -> ${nextHp.toFixed(1)}) using ${attackPower.toFixed(1)} attack × ${multiplier.toFixed(
      2,
    )} multiplier`,
  );

  return {
    success: true,
    statsChanged: true,
  };
};

export const PheromoneHealAbility: AbilityDescription<
  PheromoneHealState,
  PlayerUnitAbilityState
> = {
  abilityId: "heal",
  requiredModules: [MENDING_MODULE_ID],
  requiredSkills: ["pheromones"],
  sharedCooldownKey: "pheromones",
  createState: (context: AbilityInitializationContext) => {
    if (!context.hasModule(MENDING_MODULE_ID)) {
      return null;
    }
    if (!context.hasSkill("pheromones")) {
      return null;
    }
    if (context.unit.pheromoneHealingMultiplier <= 0) {
      return null;
    }
    const meta = context.getModuleMeta(MENDING_MODULE_ID);
    const cooldownSeconds =
      typeof meta?.cooldownSeconds === "number" && meta.cooldownSeconds > 0
        ? meta.cooldownSeconds
        : DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS;
    const charges =
      typeof meta?.healCharges === "number" && meta.healCharges > 0
        ? meta.healCharges
        : DEFAULT_MENDING_HEALS_PER_RUN;
    return {
      state: {
        chargesRemaining: charges,
        chargesTotal: charges,
      },
      cooldownSeconds,
      sharedCooldownKey: "pheromones",
    };
  },
  evaluate: (context: AbilityEvaluationContext<PheromoneHealState>) => {
    if (context.event === "hit") {
      return null;
    }
    if (context.state.chargesRemaining !== undefined && context.state.chargesRemaining <= 0) {
      return null;
    }
    if (context.cooldown.remaining > 0) {
      return null;
    }
    return evaluateHealCandidate(context);
  },
  execute: (context: AbilityExecutionContext<PheromoneHealState, PlayerUnitAbilityState>) => {
    const targetCandidate = evaluateHealCandidate(context);
    if (!targetCandidate) {
      return { success: false };
    }
    return executeHeal({ ...context, target: targetCandidate.target });
  },
};
