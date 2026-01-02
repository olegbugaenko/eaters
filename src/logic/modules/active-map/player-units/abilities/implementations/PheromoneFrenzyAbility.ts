import { UnitModuleId } from "../../../../../../db/unit-modules-db";
import {
  DEFAULT_PHEROMONE_BUFF_ATTACKS,
  DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS,
  PHEROMONE_FRENZY_EXPLOSION_RADIUS,
} from "../ability.const";
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

interface PheromoneFrenzyState extends AbilityStateBase {
  frenzyAttacks: number;
}

const FRENZY_MODULE_ID = "frenzyGland" satisfies UnitModuleId;

const findAggressionTarget = (
  source: PlayerUnitAbilityState,
  services: AbilityEvaluationContext<PheromoneFrenzyState>["services"],
  dependencies: AbilityEvaluationContext<PheromoneFrenzyState>["dependencies"],
): PlayerUnitAbilityState | null => {
  const candidates = dependencies
    .getUnits()
    .filter((candidate: PlayerUnitAbilityState) => candidate.id !== source.id && candidate.hp > 0);
  if (candidates.length === 0) {
    return null;
  }
  const withoutAura: PlayerUnitAbilityState[] = [];
  const withAura: PlayerUnitAbilityState[] = [];
  candidates.forEach((candidate: PlayerUnitAbilityState) => {
    if (services.hasEffect(candidate.id, "frenzyAura")) {
      withAura.push(candidate);
    } else {
      withoutAura.push(candidate);
    }
  });
  const pool = withoutAura.length > 0 ? withoutAura : withAura;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
};

const computeFrenzyScore = (target: PlayerUnitAbilityState): number => {
  let score = 0.15;
  const interval = Math.max(target.baseAttackInterval, 0.1);
  const rate = Math.min(1, 0.0 + (1 / interval) * 0.15);
  score += rate;
  return Math.max(0, Math.min(1, score));
};

const evaluateFrenzy = (
  context: AbilityEvaluationContext<PheromoneFrenzyState>,
): AbilityCandidate<PlayerUnitAbilityState> | null => {
  const { unit, services, dependencies } = context;
  const target = findAggressionTarget(unit, services, dependencies);
  if (!target) {
    return null;
  }
  const bonusDamage =
    Math.max(unit.baseAttackDamage, 0) * Math.max(unit.pheromoneAggressionMultiplier, 0);
  if (bonusDamage <= 0) {
    return null;
  }
  const score = computeFrenzyScore(target);
  if (score <= 0) {
    return null;
  }
  return { score, priority: 0, target };
};

const executeFrenzy = (
  context: AbilityExecutionContext<PheromoneFrenzyState, PlayerUnitAbilityState>,
): AbilityExecutionResult => {
  const { unit, state, target, services, dependencies } = context;
  const bonusDamage =
    Math.max(unit.baseAttackDamage, 0) * Math.max(unit.pheromoneAggressionMultiplier, 0);
  if (bonusDamage <= 0) {
    return { success: false };
  }
  target.pheromoneAttackBonuses.push({
    bonusDamage,
    remainingAttacks: state.frenzyAttacks,
  });
  services.applyEffect(target.id, "frenzyAura");
  services.spawnExplosionByType("magnetic", {
    position: { ...target.position },
    initialRadius: PHEROMONE_FRENZY_EXPLOSION_RADIUS,
  });
  services.spawnArcBetweenUnits("frenzy", unit, target);

  const multiplier = Math.max(unit.pheromoneAggressionMultiplier, 0);
  const attackPower = Math.max(unit.baseAttackDamage, 0);
  dependencies.logEvent(
    `${dependencies.formatUnitLabel(unit)} empowered ${dependencies.formatUnitLabel(target)} with +${bonusDamage.toFixed(
      1,
    )} damage (${attackPower.toFixed(1)} attack × ${multiplier.toFixed(2)} multiplier) for ${state.frenzyAttacks} attacks`,
  );

  return {
    success: true,
    soundId: "frenzy",
  };
};

export const PheromoneFrenzyAbility: AbilityDescription<
  PheromoneFrenzyState,
  PlayerUnitAbilityState
> = {
  abilityId: "frenzy",
  requiredModules: [FRENZY_MODULE_ID],
  requiredSkills: ["pheromones"],
  sharedCooldownKey: "pheromones",
  createState: (context: AbilityInitializationContext) => {
    if (!context.hasModule(FRENZY_MODULE_ID)) {
      return null;
    }
    if (!context.hasSkill("pheromones")) {
      return null;
    }
    if (context.unit.pheromoneAggressionMultiplier <= 0) {
      return null;
    }
    const meta = context.getModuleMeta(FRENZY_MODULE_ID);
    const cooldownSeconds =
      typeof meta?.cooldownSeconds === "number" && meta.cooldownSeconds > 0
        ? meta.cooldownSeconds
        : DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS;
    const frenzyAttacks =
      typeof meta?.frenzyAttacks === "number" && meta.frenzyAttacks > 0
        ? meta.frenzyAttacks
        : DEFAULT_PHEROMONE_BUFF_ATTACKS;
    return {
      state: {
        frenzyAttacks,
      },
      cooldownSeconds,
      sharedCooldownKey: "pheromones",
    };
  },
  evaluate: (context: AbilityEvaluationContext<PheromoneFrenzyState>) => {
    if (context.event === "hit") {
      return null;
    }
    if (context.cooldown.remaining > 0) {
      return null;
    }
    return evaluateFrenzy(context);
  },
  execute: (context: AbilityExecutionContext<PheromoneFrenzyState, PlayerUnitAbilityState>) => {
    const candidate = evaluateFrenzy(context);
    if (!candidate) {
      return { success: false };
    }
    return executeFrenzy({ ...context, target: candidate.target });
  },
};
