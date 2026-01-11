import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import { ResourceStockpile } from "../../../../db/resources-db";
import { UnitModuleWorkshopItemState } from "./unit-module-workshop.types";
import { computeBonusValue, toRecord } from "./unit-module-workshop.helpers";

export interface UnitModuleStateInput {
  readonly id: UnitModuleId;
  readonly level: number;
  readonly getUpgradeCost: (id: UnitModuleId, level: number) => ResourceStockpile;
}

export class UnitModuleStateFactory extends StateFactory<
  UnitModuleWorkshopItemState,
  UnitModuleStateInput
> {
  create(input: UnitModuleStateInput): UnitModuleWorkshopItemState {
    const config = getUnitModuleConfig(input.id);
    const costStockpile = input.getUpgradeCost(input.id, input.level);
    const costRecord = toRecord(costStockpile);

    return {
      id: input.id,
      name: config.name,
      description: config.description,
      bonusLabel: config.bonusLabel,
      bonusType: config.bonusType,
      baseBonusValue: config.baseBonusValue,
      bonusPerLevel: config.bonusPerLevel,
      currentBonusValue: computeBonusValue(
        config.baseBonusValue,
        config.bonusPerLevel,
        input.level
      ),
      manaCostMultiplier: config.manaCostMultiplier,
      sanityCost: config.sanityCost,
      level: input.level,
      nextCost: Object.keys(costRecord).length > 0 ? costRecord : null,
    };
  }
}
