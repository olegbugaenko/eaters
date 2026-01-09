import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { UNIT_MODULE_IDS, UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import { UnitDesignerAvailableModuleState } from "./unit-design.types";
import { computeModuleValue } from "./unit-design.helpers";

export interface UnitDesignerAvailableModuleInput {
  readonly moduleId: UnitModuleId;
  readonly getModuleLevel: (id: UnitModuleId) => number;
}

export class UnitDesignerAvailableModuleFactory extends StateFactory<
  UnitDesignerAvailableModuleState,
  UnitDesignerAvailableModuleInput
> {
  create(input: UnitDesignerAvailableModuleInput): UnitDesignerAvailableModuleState {
    const config = getUnitModuleConfig(input.moduleId);
    const level = input.getModuleLevel(input.moduleId);
    const bonusValue = computeModuleValue(
      config.bonusType,
      config.baseBonusValue,
      config.bonusPerLevel,
      level
    );
    return {
      id: input.moduleId,
      name: config.name,
      description: config.description,
      level,
      bonusLabel: config.bonusLabel,
      bonusType: config.bonusType,
      bonusValue,
      manaCostMultiplier: config.manaCostMultiplier,
      sanityCost: config.sanityCost,
    };
  }
}
