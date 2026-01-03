import { UnitModuleId } from "../../../../../../db/unit-modules-db";
import { getUnitModuleConfig } from "@/db/unit-modules-db";
import type { SceneVector2 } from "../../../../../services/scene-object-manager/scene-object-manager.types";
import {
  AbilityCandidate,
  AbilityDescription,
  AbilityEvaluationContext,
  AbilityExecutionContext,
  AbilityExecutionResult,
  AbilityStateBase,
} from "../ability.types";
import {
  addVectors,
  scaleVector,
  vectorHasLength,
  normalizeVector,
} from "@/shared/helpers/vector.helper";

interface TailNeedleState extends AbilityStateBase {}

const TAIL_NEEDLES_MODULE_ID = "tailNeedles" satisfies UnitModuleId;

const evaluateTailNeedle = (
  context: AbilityEvaluationContext<TailNeedleState>,
): AbilityCandidate<SceneVector2> | null => {
  if (context.event !== "hit") {
    return null;
  }

  if (!context.attackDirection || !context.inflictedDamage || !context.totalDamage) {
    return null;
  }

  const { unit } = context;
  const needleLevel = unit.moduleLevels?.tailNeedles ?? 0;
  if (needleLevel <= 0 || context.inflictedDamage <= 0) {
    return null;
  }

  const needleConfig = getUnitModuleConfig("tailNeedles");
  const projectilesPerSide = Math.max(needleConfig.meta?.lateralProjectilesPerSide ?? 0, 0);
  const spacing = Math.max(needleConfig.meta?.lateralProjectileSpacing ?? 0, 0);
  const range = Math.max(needleConfig.meta?.lateralProjectileRange ?? 0, 0);
  const visual = needleConfig.meta?.lateralProjectileVisual;
  if (!visual) {
    return null;
  }

  const base = Number.isFinite(needleConfig.baseBonusValue) ? needleConfig.baseBonusValue : 0;
  const perLevel = Number.isFinite(needleConfig.bonusPerLevel) ? needleConfig.bonusPerLevel : 0;
  const damageMultiplier = Math.max(base + perLevel * Math.max(needleLevel - 1, 0), 0);
  const projectileDamage = context.totalDamage * damageMultiplier;

  if (projectilesPerSide <= 0 || spacing <= 0 || range <= 0 || projectileDamage <= 0) {
    return null;
  }

  return {
    score: 1.0,
    priority: 0,
    target: context.attackDirection,
  };
};

const executeTailNeedle = (
  context: AbilityExecutionContext<TailNeedleState, SceneVector2>,
): AbilityExecutionResult => {
  if (!context.dependencies.projectiles) {
    return { success: false };
  }

  const { unit, target: attackDirection, dependencies } = context;
  const needleLevel = unit.moduleLevels?.tailNeedles ?? 0;
  if (needleLevel <= 0 || !context.inflictedDamage || !context.totalDamage || context.inflictedDamage <= 0) {
    return { success: false };
  }

  const needleConfig = getUnitModuleConfig("tailNeedles");
  const projectilesPerSide = Math.max(needleConfig.meta?.lateralProjectilesPerSide ?? 0, 0);
  const spacing = Math.max(needleConfig.meta?.lateralProjectileSpacing ?? 0, 0);
  const range = Math.max(needleConfig.meta?.lateralProjectileRange ?? 0, 0);
  const baseHitRadius = Math.max(needleConfig.meta?.lateralProjectileHitRadius ?? spacing * 0.5, 1);
  const visual = needleConfig.meta?.lateralProjectileVisual;
  if (!visual) {
    return { success: false };
  }

  const base = Number.isFinite(needleConfig.baseBonusValue) ? needleConfig.baseBonusValue : 0;
  const perLevel = Number.isFinite(needleConfig.bonusPerLevel) ? needleConfig.bonusPerLevel : 0;
  const damageMultiplier = Math.max(base + perLevel * Math.max(needleLevel - 1, 0), 0);
  const projectileDamage = context.totalDamage * damageMultiplier;

  if (projectilesPerSide <= 0 || spacing <= 0 || range <= 0 || projectileDamage <= 0) {
    return { success: false };
  }

  const attackVector = vectorHasLength(attackDirection)
    ? attackDirection
    : { x: Math.cos(unit.rotation ?? 0), y: Math.sin(unit.rotation ?? 0) };
  const normalized = normalizeVector(attackVector) || { x: 1, y: 0 };
  const normal = { x: -normalized.y, y: normalized.x };

  const lifetimeMs = Math.max(
    1,
    Math.min(
      visual.lifetimeMs,
      Math.ceil((range / Math.max(visual.speed, 1)) * 1000),
    ),
  );
  const visualConfig = { ...visual, hitRadius: Math.max(visual.hitRadius ?? baseHitRadius, baseHitRadius), lifetimeMs };

  // Spread projectiles along a 20-degree arc for more natural volley
  const spreadAngleRad = (20 * Math.PI) / 180; // 20 degrees in radians
  const halfSpread = spreadAngleRad / 2;
  
  const spawnSide = (side: 1 | -1) => {
    const baseAngle = Math.atan2(normal.y, normal.x) * side;
    
    for (let i = 0; i < projectilesPerSide; i += 1) {
      const offsetDistance = spacing * (i + 1) * side;
      const origin = addVectors(unit.position, scaleVector(normal, offsetDistance));
      
      // Calculate angle offset for this projectile within the arc
      let angleOffset = 0;
      if (projectilesPerSide > 1) {
        // Distribute evenly across the arc: -halfSpread to +halfSpread
        const t = i / (projectilesPerSide - 1); // 0 to 1
        angleOffset = -halfSpread + t * spreadAngleRad;
      }
      
      // Rotate the base direction by the angle offset
      const dirAngle = Math.atan2(normal.y * side, normal.x * side) + angleOffset;
      const direction: SceneVector2 = {
        x: Math.cos(dirAngle),
        y: Math.sin(dirAngle),
      };

      dependencies.projectiles!.spawn({
        origin,
        direction,
        damage: projectileDamage,
        rewardMultiplier: unit.rewardMultiplier ?? 1,
        armorPenetration: unit.armorPenetration ?? 0,
        skipKnockback: true,
        visual: visualConfig,
      });
    }
  };

  spawnSide(1);
  spawnSide(-1);

  return { success: true };
};

export const TailNeedleAbility: AbilityDescription<TailNeedleState, SceneVector2> = {
  abilityId: "tailNeedle",
  requiredModules: [TAIL_NEEDLES_MODULE_ID],
  createState: (context) => {
    if (!context.hasModule(TAIL_NEEDLES_MODULE_ID)) {
      return null;
    }
    return {
      state: {},
      cooldownSeconds: 0,
    };
  },
  evaluate: (context) => {
    return evaluateTailNeedle(context);
  },
  execute: (context) => {
    return executeTailNeedle(context);
  },
};
