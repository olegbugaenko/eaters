import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import { UnitDesignModuleDetail } from "./unit-design.types";
import { computeModuleValue } from "./unit-design.helpers";

export interface UnitDesignModuleDetailInput {
  readonly moduleId: UnitModuleId;
  readonly getModuleLevel: (id: UnitModuleId) => number;
}

export class UnitDesignModuleDetailFactory extends StateFactory<
  UnitDesignModuleDetail,
  UnitDesignModuleDetailInput
> {
  create(input: UnitDesignModuleDetailInput): UnitDesignModuleDetail {
    const config = getUnitModuleConfig(input.moduleId);
    const level = input.getModuleLevel(input.moduleId);

    if (level <= 0) {
      throw new Error(`Module ${input.moduleId} has invalid level: ${level}`);
    }

    return {
      id: input.moduleId,
      name: config.name,
      description: config.description,
      level,
      bonusLabel: config.bonusLabel,
      bonusType: config.bonusType,
      bonusValue: computeModuleValue(
        config.bonusType,
        config.baseBonusValue,
        config.bonusPerLevel,
        level
      ),
      manaCostMultiplier: config.manaCostMultiplier,
      sanityCost: config.sanityCost,
    };
  }

  /**
   * Створює деталі тільки для модулів з рівнем > 0.
   */
  createManyWithLevelFilter(inputs: readonly UnitDesignModuleDetailInput[]): UnitDesignModuleDetail[] {
    return this.createManyFiltered(
      inputs,
      (detail) => detail.level > 0
    );
  }
}
