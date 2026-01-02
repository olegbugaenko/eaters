import { UnitModuleId } from "../../../../../db/unit-modules-db";
import {
  AbilityCandidate,
  AbilityDescription,
  AbilityEvaluationContext,
  AbilityExecutionContext,
  AbilityExecutionResult,
  AbilityStateBase,
} from "./AbilityTypes";

interface FireballAbilityState extends AbilityStateBase {
  explosionRadius: number;
  selfDamagePercent: number;
  maxDistance: number;
}

const FIREBALL_MODULE_ID = "fireballOrgan" satisfies UnitModuleId;
const DEFAULT_FIREBALL_COOLDOWN_SECONDS = 4;
const DEFAULT_FIREBALL_EXPLOSION_RADIUS = 40;
const DEFAULT_FIREBALL_SELF_DAMAGE_PERCENT = 0.75;
const DEFAULT_FIREBALL_MAX_DISTANCE = 750;

const evaluateFireball = (
  context: AbilityEvaluationContext<FireballAbilityState>,
): AbilityCandidate<string> | null => {
  const { unit, dependencies } = context;
  const targetBrickId = dependencies.findNearestBrick(unit.position);
  if (!targetBrickId) {
    return null;
  }
  if (unit.fireballDamageMultiplier <= 0) {
    return null;
  }
  return { score: 0.7, priority: 1, target: targetBrickId };
};

const executeFireball = (
  context: AbilityExecutionContext<FireballAbilityState, string>,
): AbilityExecutionResult => {
  const { unit, target, services, dependencies, state } = context;
  const damage = Math.max(unit.baseAttackDamage, 0) * Math.max(unit.fireballDamageMultiplier, 0);
  if (damage <= 0) {
    return { success: false };
  }
  const launched = services.launchFireball({
    sourceUnitId: unit.id,
    sourcePosition: unit.position,
    targetBrickId: target,
    damage,
    explosionRadius: state.explosionRadius,
    maxDistance: state.maxDistance,
  });
  if (!launched) {
    return { success: false };
  }
  const selfDamagePercent = Math.max(state.selfDamagePercent, 0);
  const rawSelfDamage = damage * selfDamagePercent;
  const selfDamage = selfDamagePercent > 0 ? Math.max(rawSelfDamage, 1) : 0;
  if (selfDamage > 0) {
    dependencies.damageUnit(unit.id, selfDamage);
  }
  dependencies.logEvent(
    `${dependencies.formatUnitLabel(unit)} launched fireball targeting brick ${target} for ${damage.toFixed(
      1,
    )} damage (self-damage: ${selfDamage.toFixed(1)})`,
  );
  return {
    success: true,
    soundId: "fireball",
  };
};

export const FireballAbility: AbilityDescription<FireballAbilityState, string> = {
  abilityId: "fireball",
  requiredModules: [FIREBALL_MODULE_ID],
  sharedCooldownKey: "fireball",
  createState: (context) => {
    if (!context.hasModule(FIREBALL_MODULE_ID)) {
      return null;
    }
    if (context.unit.fireballDamageMultiplier <= 0) {
      return null;
    }
    const meta = context.getModuleMeta(FIREBALL_MODULE_ID);
    const explosionRadius =
      typeof meta?.fireballExplosionRadius === "number" && meta.fireballExplosionRadius > 0
        ? meta.fireballExplosionRadius
        : DEFAULT_FIREBALL_EXPLOSION_RADIUS;
    const selfDamagePercent =
      typeof meta?.fireballSelfDamagePercent === "number" && meta.fireballSelfDamagePercent >= 0
        ? meta.fireballSelfDamagePercent
        : DEFAULT_FIREBALL_SELF_DAMAGE_PERCENT;
    const maxDistance =
      typeof meta?.fireballMaxDistance === "number" && meta.fireballMaxDistance > 0
        ? meta.fireballMaxDistance
        : DEFAULT_FIREBALL_MAX_DISTANCE;
    const cooldownSeconds =
      typeof meta?.cooldownSeconds === "number" && meta.cooldownSeconds > 0
        ? meta.cooldownSeconds
        : DEFAULT_FIREBALL_COOLDOWN_SECONDS;
    return {
      state: {
        explosionRadius,
        selfDamagePercent,
        maxDistance,
      },
      cooldownSeconds,
      sharedCooldownKey: "fireball",
    };
  },
  evaluate: (context) => {
    if (context.cooldown.remaining > 0) {
      return null;
    }
    return evaluateFireball(context);
  },
  execute: (context) => {
    const candidate = evaluateFireball(context);
    if (!candidate) {
      return { success: false };
    }
    return executeFireball({ ...context, target: candidate.target });
  },
};
