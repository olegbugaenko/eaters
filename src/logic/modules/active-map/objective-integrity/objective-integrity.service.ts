import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import type { BricksModule } from "../bricks/bricks.module";
import type { EnemiesModule } from "../enemies/enemies.module";
import { OBJECTIVE_TOTAL_HP_BRIDGE_KEY } from "./objective-integrity.const";

export interface ObjectiveIntegritySnapshot {
  readonly totalHp: number;
  readonly bricksRemaining: boolean;
  readonly requiredEnemiesRemaining: boolean;
}

export class ObjectiveIntegrityService {
  private lastPushedTotalHp = -1;

  constructor(
    private readonly bridge: DataBridge,
    private readonly bricks: BricksModule,
    private readonly enemies: EnemiesModule,
  ) {}

  public reset(): void {
    this.lastPushedTotalHp = -1;
    DataBridgeHelpers.pushState(this.bridge, OBJECTIVE_TOTAL_HP_BRIDGE_KEY, 0);
  }

  public refresh(): ObjectiveIntegritySnapshot {
    const brickTotals = this.bricks.getBrickTotals();
    const enemyTotals = this.enemies.getObjectiveTotals();
    const totalHp = Math.max(0, brickTotals.totalHp + enemyTotals.totalHp);
    const clampedTotalHp = Math.max(0, Math.floor(totalHp));
    if (clampedTotalHp !== this.lastPushedTotalHp) {
      DataBridgeHelpers.pushState(this.bridge, OBJECTIVE_TOTAL_HP_BRIDGE_KEY, clampedTotalHp);
      this.lastPushedTotalHp = clampedTotalHp;
    }
    return {
      totalHp,
      bricksRemaining: brickTotals.count > 0,
      requiredEnemiesRemaining: enemyTotals.count > 0,
    };
  }
}
