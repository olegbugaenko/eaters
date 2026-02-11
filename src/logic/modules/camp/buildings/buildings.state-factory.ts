import { StateFactory } from "@/core/logic/provided/factories/StateFactory";
import { BuildingId, getBuildingConfig } from "../../../../db/buildings-db";
import { ResourceStockpile, normalizeResourceAmount } from "../../../../db/resources-db";
import { BuildingWorkshopItemState } from "./buildings.types";
import type { BonusEffectPreview } from "@shared/types/bonuses";
import type { UnlockService } from "../../../services/unlock/UnlockService";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import { getMaxLevel } from "./buildings.helpers";

export interface BuildingTextResolver {
  readonly getText: (input: { id: BuildingId; name: string; description: string }) => {
    name: string;
    description: string;
  };
}

export interface BuildingStateInput {
  readonly id: BuildingId;
  readonly level: number;
  readonly unlocks: UnlockService;
  readonly bonuses: BonusesModule;
  readonly getBonusSourceId: (id: BuildingId) => string;
  readonly cloneCost: (source: ResourceStockpile) => Record<string, number>;
  readonly applyCostModifiers: (source: ResourceStockpile) => ResourceStockpile;
}

export class BuildingStateFactory extends StateFactory<
  BuildingWorkshopItemState,
  BuildingStateInput
> {
  constructor(private readonly textResolver?: BuildingTextResolver) {
    super();
  }

  create(input: BuildingStateInput): BuildingWorkshopItemState {
    const config = getBuildingConfig(input.id);
    const maxLevelLimit = getMaxLevel(config);
    const maxLevel = config.maxLevel ?? null;
    const available = input.unlocks.areConditionsMet(config.unlockedBy);
    const maxed = input.level >= maxLevelLimit;
    const canUpgrade = available && !maxed;
    const nextCost = canUpgrade
      ? input.cloneCost(
          input.applyCostModifiers(normalizeResourceAmount(config.cost(input.level + 1)))
        )
      : null;
    let bonusEffects: readonly BonusEffectPreview[] = input.bonuses.getBonusEffects(input.getBonusSourceId(input.id));
    if (maxed) {
      const mapped = bonusEffects.map((effect) => ({
        ...effect,
        nextValue: effect.currentValue,
      }));
      bonusEffects = mapped as readonly BonusEffectPreview[];
    }
    const localized = this.textResolver?.getText({
      id: input.id,
      name: config.name,
      description: config.description,
    }) ?? {
      name: config.name,
      description: config.description,
    };

    return {
      id: input.id,
      name: localized.name,
      description: localized.description,
      level: input.level,
      maxLevel,
      maxed,
      available,
      nextCost,
      bonusEffects,
    };
  }
}
