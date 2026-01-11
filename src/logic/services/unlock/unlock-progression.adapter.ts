import type { ProgressionSource } from "@core/logic/provided/services/gameplay-ports";
import type { MapId } from "@db/maps-db";
import type { SkillId } from "@db/skills-db";
import type { UnlockConditionList } from "@shared/types/unlocks";
import { UnlockService } from "./UnlockService";

export class UnlockProgressionAdapter implements ProgressionSource<MapId, SkillId> {
  constructor(private readonly unlocks: UnlockService) {}

  public areConditionsMet(
    conditions: UnlockConditionList<MapId, SkillId> | undefined
  ): boolean {
    return this.unlocks.areConditionsMet(conditions);
  }

  public clearCache(): void {
    this.unlocks.clearCache();
  }
}
