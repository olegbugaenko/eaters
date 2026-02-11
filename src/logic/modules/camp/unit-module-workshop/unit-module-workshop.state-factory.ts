import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { UnitModuleId, getUnitModuleConfig } from "../../../../db/unit-modules-db";
import { ResourceStockpile } from "../../../../db/resources-db";
import { UnitModuleWorkshopItemState } from "./unit-module-workshop.types";
import { computeBonusValue, getMaxLevel, toRecord } from "./unit-module-workshop.helpers";

export interface UnitModuleTextResolver {
  readonly getText: (input: { id: UnitModuleId; name: string; description: string; bonusLabel: string }) => {
    name: string;
    description: string;
    bonusLabel: string;
  };
}

export interface UnitModuleStateInput {
  readonly id: UnitModuleId;
  readonly level: number;
  readonly getUpgradeCost: (id: UnitModuleId, level: number) => ResourceStockpile;
}

export class UnitModuleStateFactory extends StateFactory<
  UnitModuleWorkshopItemState,
  UnitModuleStateInput
> {
  constructor(private readonly textResolver?: UnitModuleTextResolver) {
    super();
  }

  create(input: UnitModuleStateInput): UnitModuleWorkshopItemState {
    const config = getUnitModuleConfig(input.id);
    const maxLevelLimit = getMaxLevel(config);
    const maxLevel = config.maxLevel ?? null;
    const maxed = input.level >= maxLevelLimit;
    const costStockpile = maxed ? null : input.getUpgradeCost(input.id, input.level);
    const costRecord = costStockpile ? toRecord(costStockpile) : null;

    const localized = this.textResolver?.getText({
      id: input.id,
      name: config.name,
      description: config.description,
      bonusLabel: config.bonusLabel,
    }) ?? {
      name: config.name,
      description: config.description,
      bonusLabel: config.bonusLabel,
    };

    return {
      id: input.id,
      name: localized.name,
      description: localized.description,
      bonusLabel: localized.bonusLabel,
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
      maxLevel,
      maxed,
      nextCost: costRecord && Object.keys(costRecord).length > 0 ? costRecord : null,
    };
  }
}
