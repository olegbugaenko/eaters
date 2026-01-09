import type { BonusValueSource } from "@core/logic/provided/services/gameplay-ports";
import type { BonusId } from "@db/bonuses-db";
import { BonusesModule } from "./bonuses.module";

export class BonusesValueAdapter implements BonusValueSource {
  constructor(private readonly bonuses: BonusesModule) {}

  public getBonusValue(id: BonusId): number {
    return this.bonuses.getBonusValue(id);
  }
}
