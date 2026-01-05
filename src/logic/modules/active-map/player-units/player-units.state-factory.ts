import { StateFactory } from "../../../core/factories/StateFactory";
import type { PlayerUnitState } from "./units/UnitTypes";
import type { PlayerUnitSpawnData } from "./player-units.types";
import type { UnitFactory, UnitFactoryResult } from "./units/UnitFactory";
import type { PlayerUnitBlueprintStats } from "@shared/types/player-units";
import type { UnitModuleId } from "../../../../db/unit-modules-db";
import { ZERO_VECTOR } from "../../../../shared/helpers/geometry.const";
import type { UnitTargetingMode } from "@shared/types/unit-targeting";
import type { PlayerUnitType } from "../../../../db/player-units-db";
import { sanitizeUnitType } from "./player-units.helpers";

export interface UnitStateInput {
  readonly unit: PlayerUnitSpawnData;
  readonly unitFactory: UnitFactory;
  readonly unitId: string;
  readonly blueprint: PlayerUnitBlueprintStats;
  readonly getModuleLevel: (id: UnitModuleId) => number;
  readonly getDesignTargetingMode: (designId: string | null, type: PlayerUnitType) => UnitTargetingMode;
  readonly getAbilityCooldownSeconds: () => number;
}

export interface UnitStateFactoryOptions {
  readonly updateInternalFurnaceEffect: (unit: PlayerUnitState) => void;
  readonly pushUnitSceneState: (unit: PlayerUnitState, options?: { forceFill?: boolean }) => void;
}

export class UnitStateFactory extends StateFactory<PlayerUnitState, UnitStateInput> {
  private readonly updateInternalFurnaceEffect: (unit: PlayerUnitState) => void;
  private readonly pushUnitSceneState: (unit: PlayerUnitState, options?: { forceFill?: boolean }) => void;

  constructor(options: UnitStateFactoryOptions) {
    super();
    this.updateInternalFurnaceEffect = options.updateInternalFurnaceEffect;
    this.pushUnitSceneState = options.pushUnitSceneState;
  }

  create(input: UnitStateInput): PlayerUnitState {
    const { unit, unitFactory, unitId, blueprint, getModuleLevel, getDesignTargetingMode, getAbilityCooldownSeconds } = input;
    const type = sanitizeUnitType(unit.type);

    const factoryResult: UnitFactoryResult = unitFactory.createUnit(
      {
        designId: unit.designId,
        type,
        position: unit.position,
        hp: unit.hp,
        attackCooldown: unit.attackCooldown,
        runtimeModifiers: unit.runtimeModifiers,
        equippedModules: unit.equippedModules,
      },
      blueprint,
      unitId,
    );

    const moduleLevels: Partial<Record<UnitModuleId, number>> = {};
    factoryResult.abilityContext.equippedModules.forEach((moduleId) => {
      const level = Math.max(getModuleLevel(moduleId), 0);
      if (level > 0) {
        moduleLevels[moduleId] = level;
      }
    });

    const state: PlayerUnitState = {
      id: factoryResult.id,
      designId: factoryResult.designId,
      type: factoryResult.type,
      position: { ...factoryResult.position },
      spawnPosition: { ...factoryResult.spawnPosition },
      movementId: factoryResult.movementId,
      rotation: 0,
      hp: factoryResult.hp,
      maxHp: factoryResult.maxHp,
      armor: factoryResult.armor,
      hpRegenPerSecond: factoryResult.hpRegenPerSecond,
      armorPenetration: factoryResult.armorPenetration,
      baseAttackDamage: factoryResult.baseAttackDamage,
      baseAttackInterval: factoryResult.baseAttackInterval,
      baseAttackDistance: factoryResult.baseAttackDistance,
      moveSpeed: factoryResult.moveSpeed,
      moveAcceleration: factoryResult.moveAcceleration,
      mass: factoryResult.mass,
      physicalSize: factoryResult.physicalSize,
      knockBackReduction: factoryResult.knockBackReduction,
      critChance: factoryResult.critChance,
      critMultiplier: factoryResult.critMultiplier,
      rewardMultiplier: factoryResult.rewardMultiplier,
      damageTransferPercent: factoryResult.damageTransferPercent,
      damageTransferRadius: factoryResult.damageTransferRadius,
      attackStackBonusPerHit: factoryResult.attackStackBonusPerHit,
      attackStackBonusCap: factoryResult.attackStackBonusCap,
      currentAttackStackBonus: 0,
      attackCooldown: factoryResult.attackCooldown,
      targetBrickId: null,
      objectId: factoryResult.objectId,
      renderer: factoryResult.renderer,
      emitter: factoryResult.emitter,
      baseFillColor: factoryResult.baseFillColor,
      baseStrokeColor: factoryResult.baseStrokeColor,
      appliedFillColor: { ...factoryResult.baseFillColor },
      appliedStrokeColor: factoryResult.baseStrokeColor ? { ...factoryResult.baseStrokeColor } : undefined,
      visualEffects: factoryResult.visualEffects,
      visualEffectsDirty: false,
      preCollisionVelocity: { ...ZERO_VECTOR },
      lastNonZeroVelocity: { ...ZERO_VECTOR },
      timeSinceLastAttack: 0,
      timeSinceLastSpecial: getAbilityCooldownSeconds(),
      pheromoneHealingMultiplier: factoryResult.pheromoneHealingMultiplier,
      pheromoneAggressionMultiplier: factoryResult.pheromoneAggressionMultiplier,
      pheromoneAttackBonuses: [],
      fireballDamageMultiplier: factoryResult.fireballDamageMultiplier,
      canUnitAttackDistant: factoryResult.canUnitAttackDistant,
      moduleLevels,
      equippedModules: factoryResult.abilityContext.equippedModules,
      ownedSkills: factoryResult.abilityContext.ownedSkills,
      targetingMode: getDesignTargetingMode(factoryResult.designId, factoryResult.type),
      wanderTarget: null,
      wanderCooldown: 0,
    };

    return state;
  }

  /**
   * Застосовує side effects: оновлює furnace effect та push до scene.
   */
  protected override transform(state: PlayerUnitState, _input: UnitStateInput): void {
    this.updateInternalFurnaceEffect(state);
    if (state.visualEffectsDirty) {
      this.pushUnitSceneState(state, { forceFill: true });
    }
  }
}
