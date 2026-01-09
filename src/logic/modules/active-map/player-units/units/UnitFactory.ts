import type { ParticleEmitterConfig } from "../../../../interfaces/visuals/particle-emitters-config";
import { SceneVector2, SceneColor } from "../../../../services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "../../../../services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import { MovementService } from "../../../../services/movement/MovementService";
import {
  PlayerUnitType,
  getPlayerUnitConfig,
  PlayerUnitRendererConfig,
  PlayerUnitConfig,
  PlayerUnitAuraConfig,
} from "../../../../../db/player-units-db";
import {
  PlayerUnitBlueprintStats,
  PlayerUnitRuntimeModifiers,
} from "@shared/types/player-units";
import {
  VisualEffectState,
  createVisualEffectState,
} from "../../../../visuals/VisualEffectState";
import { UnitDesignId } from "../../../camp/unit-design/unit-design.types";
import { UnitModuleId, UNIT_MODULE_IDS, getUnitModuleConfig } from "../../../../../db/unit-modules-db";
import type { SkillId } from "../../../../../db/skills-db";
import { PLAYER_UNIT_ABILITY_DEFINITIONS } from "../abilities";
import type { AbilityDescription } from "../abilities/ability.types";
import { clampNumber, clampProbability } from "@shared/helpers/numbers.helper";
import { sanitizeRuntimeModifiers } from "../player-units.helpers";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";
import {
  cloneRendererConfigForScene,
  cloneAuraConfig,
} from "@shared/helpers/renderer-clone.helper";

export interface UnitFactoryOptions {
  scene: SceneObjectManager;
  movement: MovementService;
  getModuleLevel: (id: UnitModuleId) => number;
  hasSkill: (id: SkillId) => boolean;
  getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => string;
}

export interface UnitCreationData {
  readonly designId?: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly hp?: number;
  readonly attackCooldown?: number;
  readonly runtimeModifiers?: PlayerUnitRuntimeModifiers;
  readonly equippedModules?: UnitModuleId[];
}

export interface UnitAbilityContext {
  readonly equippedModules: readonly UnitModuleId[];
  readonly ownedSkills: readonly SkillId[];
  readonly availableAbilities: readonly AbilityDescription<any, any>[];
}

export interface UnitFactoryResult {
  readonly id: string;
  readonly designId: UnitDesignId | null;
  readonly type: PlayerUnitType;
  readonly position: SceneVector2;
  readonly spawnPosition: SceneVector2;
  readonly movementId: string;
  readonly objectId: string;
  readonly blueprint: PlayerUnitBlueprintStats;
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  readonly hpRegenPerSecond: number;
  readonly armorPenetration: number;
  readonly baseAttackDamage: number;
  readonly baseAttackInterval: number;
  readonly baseAttackDistance: number;
  readonly moveSpeed: number;
  readonly moveAcceleration: number;
  readonly mass: number;
  readonly physicalSize: number;
  readonly knockBackReduction: number;
  readonly critChance: number;
  readonly critMultiplier: number;
  readonly rewardMultiplier: number;
  readonly damageTransferPercent: number;
  readonly damageTransferRadius: number;
  readonly attackStackBonusPerHit: number;
  readonly attackStackBonusCap: number;
  readonly attackCooldown: number;
  readonly targetingMode: string;
  readonly renderer: PlayerUnitRendererConfig;
  readonly emitter?: ParticleEmitterConfig;
  readonly baseFillColor: SceneColor;
  readonly baseStrokeColor?: SceneColor;
  readonly visualEffects: VisualEffectState;
  readonly abilityContext: UnitAbilityContext;
  readonly pheromoneHealingMultiplier: number;
  readonly pheromoneAggressionMultiplier: number;
  readonly fireballDamageMultiplier: number;
  readonly canUnitAttackDistant: boolean;
}

import { cloneEmitter } from "../player-units.helpers";

// All cloning functions are now imported from @shared/helpers/renderer-clone.helper
// Using shallow clone (deep: false) for performance in UnitFactory
const cloneRendererConfigForSceneShallow = (
  renderer: PlayerUnitRendererConfig
): PlayerUnitRendererConfig => {
  return cloneRendererConfigForScene(renderer, { deep: false });
};

export class UnitFactory {
  private readonly scene: SceneObjectManager;
  private readonly movement: MovementService;
  private readonly getModuleLevel: (id: UnitModuleId) => number;
  private readonly hasSkill: (id: SkillId) => boolean;
  private readonly getDesignTargetingMode: (
    designId: UnitDesignId | null,
    type: PlayerUnitType
  ) => string;
  private idCounter = 0;

  constructor(options: UnitFactoryOptions) {
    this.scene = options.scene;
    this.movement = options.movement;
    this.getModuleLevel = options.getModuleLevel;
    this.hasSkill = options.hasSkill;
    this.getDesignTargetingMode = options.getDesignTargetingMode;
  }

  public createUnit(
    data: UnitCreationData,
    blueprint: PlayerUnitBlueprintStats,
    unitId: string,
  ): UnitFactoryResult {
    const config = getPlayerUnitConfig(data.type);
    const position = this.clampToMap(data.position);
    const maxHp = Math.max(blueprint.effective.maxHp, 1);
    const hp = clampNumber(data.hp ?? maxHp, 0, maxHp);
    const attackCooldown = clampNumber(
      data.attackCooldown ?? 0,
      0,
      blueprint.baseAttackInterval
    );
    const critChance = clampProbability(blueprint.critChance.effective);
    const critMultiplier = Math.max(blueprint.critMultiplier.effective, 1);
    const runtime = sanitizeRuntimeModifiers(data.runtimeModifiers);

    const mass = Math.max(blueprint.mass, 0.001);
    const moveAcceleration = Math.max(blueprint.moveAcceleration, 0);
    const physicalSize = Math.max(blueprint.physicalSize, 0);
    const movementId = this.movement.createBody({
      position,
      mass,
      maxSpeed: Math.max(blueprint.moveSpeed, 0),
    });

    const emitter = config.emitter ? cloneEmitter(config.emitter) : undefined;
    const baseFillColor: SceneColor = {
      r: config.renderer.fill.r,
      g: config.renderer.fill.g,
      b: config.renderer.fill.b,
      a: typeof config.renderer.fill.a === "number" ? config.renderer.fill.a : 1,
    };
    // Use explicit stroke color if defined, otherwise fallback to fill color
    // This ensures stroke overlays work for units with layer-level strokes
    const baseStrokeColor: SceneColor = config.renderer.stroke
      ? {
          r: config.renderer.stroke.color.r,
          g: config.renderer.stroke.color.g,
          b: config.renderer.stroke.color.b,
          a:
            typeof config.renderer.stroke.color.a === "number"
              ? config.renderer.stroke.color.a
              : 1,
        }
      : { ...baseFillColor };
    const visualEffects = createVisualEffectState();

    const ownedModuleIds = Array.isArray(data.equippedModules)
      ? data.equippedModules.filter((id): id is UnitModuleId => UNIT_MODULE_IDS.includes(id))
      : [];
    const ownedSkills = this.collectOwnedSkills();
    const abilityContext = this.createAbilityContext(ownedModuleIds, ownedSkills);

    const mendingLevel = ownedModuleIds.includes("mendingGland")
      ? Math.max(this.getModuleLevel("mendingGland"), 0)
      : 0;
    const pheromoneHealingMultiplier = mendingLevel > 0 ? 1 + 0.1 * mendingLevel : 0;
    const frenzyLevel = ownedModuleIds.includes("frenzyGland")
      ? Math.max(this.getModuleLevel("frenzyGland"), 0)
      : 0;
    const pheromoneAggressionMultiplier = frenzyLevel > 0 ? 1 + 0.1 * frenzyLevel : 0;
    const fireballLevel = ownedModuleIds.includes("fireballOrgan")
      ? Math.max(this.getModuleLevel("fireballOrgan"), 0)
      : 0;
    const fireballDamageMultiplier = fireballLevel > 0 ? 1.75 + 0.075 * fireballLevel : 0;

    const canUnitAttackDistant = ownedModuleIds.some((moduleId) => {
      try {
        const moduleConfig = getUnitModuleConfig(moduleId);
        return moduleConfig.canAttackDistant === true;
      } catch {
        return false;
      }
    });

    const objectId = this.scene.addObject("playerUnit", {
      position,
      fill: {
        fillType: FILL_TYPES.SOLID,
        color: { ...baseFillColor },
      },
      stroke: config.renderer.stroke
        ? {
            color: { ...config.renderer.stroke.color },
            width: config.renderer.stroke.width,
          }
        : undefined,
      rotation: 0,
      customData: {
        renderer: cloneRendererConfigForSceneShallow(config.renderer),
        emitter,
        physicalSize,
        baseFillColor: { ...baseFillColor },
        baseStrokeColor: baseStrokeColor ? { ...baseStrokeColor } : undefined,
        modules: ownedModuleIds,
        skills: ownedSkills,
      },
    });

    return {
      id: unitId,
      designId: data.designId ?? null,
      type: data.type,
      position: { ...position },
      spawnPosition: { ...position },
      movementId,
      objectId,
      blueprint,
      hp,
      maxHp,
      armor: Math.max(blueprint.armor, 0),
      hpRegenPerSecond: Math.max(blueprint.hpRegenPerSecond, 0),
      armorPenetration: Math.max(blueprint.armorPenetration, 0),
      baseAttackDamage: Math.max(blueprint.effective.attackDamage, 0),
      baseAttackInterval: Math.max(blueprint.baseAttackInterval, 0.01),
      baseAttackDistance: Math.max(blueprint.baseAttackDistance, 0),
      moveSpeed: Math.max(blueprint.moveSpeed, 0),
      moveAcceleration,
      mass,
      physicalSize,
      knockBackReduction: Math.max(blueprint.knockbackReduction * runtime.knockBackReduction, 1),
      critChance,
      critMultiplier,
      rewardMultiplier: runtime.rewardMultiplier,
      damageTransferPercent: runtime.damageTransferPercent,
      damageTransferRadius: runtime.damageTransferRadius,
      attackStackBonusPerHit: runtime.attackStackBonusPerHit,
      attackStackBonusCap: runtime.attackStackBonusCap,
      attackCooldown,
      targetingMode: this.getDesignTargetingMode(data.designId ?? null, data.type),
      renderer: config.renderer,
      emitter,
      baseFillColor,
      baseStrokeColor,
      visualEffects,
      abilityContext,
      pheromoneHealingMultiplier,
      pheromoneAggressionMultiplier,
      fireballDamageMultiplier,
      canUnitAttackDistant,
    };
  }

  public createUnitId(): string {
    this.idCounter += 1;
    return `player-unit-${this.idCounter}`;
  }

  private collectOwnedSkills(): SkillId[] {
    const skills: SkillId[] = [];
    if (this.hasSkill("void_modules")) {
      skills.push("void_modules");
    }
    if (this.hasSkill("pheromones")) {
      skills.push("pheromones");
    }
    return skills;
  }

  private createAbilityContext(
    equippedModules: readonly UnitModuleId[],
    ownedSkills: readonly SkillId[],
  ): UnitAbilityContext {
    const availableAbilities = PLAYER_UNIT_ABILITY_DEFINITIONS.filter((ability) => {
      if (ability.requiredModules) {
        const hasRequiredModules = ability.requiredModules.every((moduleId) =>
          equippedModules.includes(moduleId)
        );
        if (!hasRequiredModules) {
          return false;
        }
      }
      if (ability.requiredSkills) {
        const hasRequiredSkills = ability.requiredSkills.every((skillId) =>
          ownedSkills.includes(skillId)
        );
        if (!hasRequiredSkills) {
          return false;
        }
      }
      return true;
    });

    return {
      equippedModules,
      ownedSkills,
      availableAbilities,
    };
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }
}
