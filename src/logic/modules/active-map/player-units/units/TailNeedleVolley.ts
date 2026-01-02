import { getUnitModuleConfig } from "@/db/unit-modules-db";
import type { SceneVector2 } from "../../../../services/SceneObjectManager";
import type { UnitProjectileController } from "./UnitProjectileController";
import type { PlayerUnitState } from "./UnitTypes";

const vectorHasLength = (vector: SceneVector2, epsilon = 0.0001): boolean =>
  Math.abs(vector.x) > epsilon || Math.abs(vector.y) > epsilon;

const vectorLength = (vector: SceneVector2): number => Math.hypot(vector.x, vector.y);

const normalize = (vector: SceneVector2): SceneVector2 => {
  const length = vectorLength(vector) || 1;
  return { x: vector.x / length, y: vector.y / length };
};

const scale = (vector: SceneVector2, scalar: number): SceneVector2 => ({
  x: vector.x * scalar,
  y: vector.y * scalar,
});

const add = (a: SceneVector2, b: SceneVector2): SceneVector2 => ({
  x: a.x + b.x,
  y: a.y + b.y,
});

interface TailNeedleVolleyOptions {
  unit: PlayerUnitState;
  attackDirection: SceneVector2;
  inflictedDamage: number;
  totalDamage: number;
  projectiles: UnitProjectileController;
}

export const spawnTailNeedleVolley = (options: TailNeedleVolleyOptions): void => {
  const { unit, attackDirection, inflictedDamage, totalDamage, projectiles } = options;
  const needleLevel = unit.moduleLevels?.tailNeedles ?? 0;
  if (needleLevel <= 0 || inflictedDamage <= 0) {
    return;
  }

  const needleConfig = getUnitModuleConfig("tailNeedles");
  const projectilesPerSide = Math.max(needleConfig.meta?.lateralProjectilesPerSide ?? 0, 0);
  const spacing = Math.max(needleConfig.meta?.lateralProjectileSpacing ?? 0, 0);
  const range = Math.max(needleConfig.meta?.lateralProjectileRange ?? 0, 0);
  const baseHitRadius = Math.max(needleConfig.meta?.lateralProjectileHitRadius ?? spacing * 0.5, 1);
  const visual = needleConfig.meta?.lateralProjectileVisual;
  if (!visual) {
    return;
  }

  const base = Number.isFinite(needleConfig.baseBonusValue) ? needleConfig.baseBonusValue : 0;
  const perLevel = Number.isFinite(needleConfig.bonusPerLevel) ? needleConfig.bonusPerLevel : 0;
  const damageMultiplier = Math.max(base + perLevel * Math.max(needleLevel - 1, 0), 0);
  const projectileDamage = totalDamage * damageMultiplier;

  if (projectilesPerSide <= 0 || spacing <= 0 || range <= 0 || projectileDamage <= 0) {
    return;
  }

  const attackVector = vectorHasLength(attackDirection)
    ? attackDirection
    : { x: Math.cos(unit.rotation), y: Math.sin(unit.rotation) };
  const normalized = normalize(attackVector);
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
      const origin = add(unit.position, scale(normal, offsetDistance));
      
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

      projectiles.spawn({
        origin,
        direction,
        damage: projectileDamage,
        rewardMultiplier: unit.rewardMultiplier,
        armorPenetration: unit.armorPenetration,
        skipKnockback: true,
        visual: visualConfig,
      });
    }
  };

  spawnSide(1);
  spawnSide(-1);
};
