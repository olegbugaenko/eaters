import type { SceneVector2 } from "../../../../services/scene-object-manager/scene-object-manager.types";
import type { PlayerUnitType } from "../../../../../db/player-units-db";
import type { SkillId } from "../../../../../db/skills-db";
import type { UnitModuleId } from "../../../../../db/unit-modules-db";

export interface PlayerUnitAbilityState {
  id: string;
  type: PlayerUnitType;
  position: SceneVector2;
  hp: number;
  maxHp: number;
  baseAttackDamage: number;
  baseAttackInterval: number;
  pheromoneHealingMultiplier: number;
  pheromoneAggressionMultiplier: number;
  timeSinceLastAttack: number;
  timeSinceLastSpecial: number;
  fireballDamageMultiplier: number;
  equippedModules: readonly UnitModuleId[];
  ownedSkills: readonly SkillId[];
  moduleLevels?: Partial<Record<UnitModuleId, number>>;
  rotation?: number;
  rewardMultiplier?: number;
  armorPenetration?: number;
}
