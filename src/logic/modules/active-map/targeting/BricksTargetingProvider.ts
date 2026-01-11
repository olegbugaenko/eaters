import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { BricksModule } from "../bricks/bricks.module";
import type { BrickRuntimeState } from "../bricks/bricks.types";
import type {
  TargetSnapshot,
  TargetingFilter,
  TargetingProvider,
} from "./targeting.types";

export class BricksTargetingProvider implements TargetingProvider<"brick", BrickRuntimeState> {
  public readonly types = ["brick"] as const;

  constructor(private readonly bricks: BricksModule) {}

  public getById(id: string): TargetSnapshot<"brick", BrickRuntimeState> | null {
    const brick = this.bricks.getBrickState(id);
    return brick ? this.toTarget(brick) : null;
  }

  public findNearest(
    position: SceneVector2,
    _filter?: TargetingFilter,
  ): TargetSnapshot<"brick", BrickRuntimeState> | null {
    const brick = this.bricks.findNearestBrick(position);
    return brick ? this.toTarget(brick) : null;
  }

  public findInRadius(
    position: SceneVector2,
    radius: number,
    _filter?: TargetingFilter,
  ): TargetSnapshot<"brick", BrickRuntimeState>[] {
    if (radius < 0) {
      return [];
    }
    const bricks = this.bricks.findBricksNear(position, radius);
    return bricks.map((brick) => this.toTarget(brick));
  }

  public forEachInRadius(
    position: SceneVector2,
    radius: number,
    visitor: (target: TargetSnapshot<"brick", BrickRuntimeState>) => void,
    _filter?: TargetingFilter,
  ): void {
    if (radius < 0) {
      return;
    }
    this.bricks.forEachBrickNear(position, radius, (brick) => {
      const snapshot = this.bricks.getBrickState(brick.id);
      if (!snapshot) {
        return;
      }
      visitor(this.toTarget(snapshot));
    });
  }

  private toTarget(brick: BrickRuntimeState): TargetSnapshot<"brick", BrickRuntimeState> {
    return {
      id: brick.id,
      type: "brick",
      position: { ...brick.position },
      hp: brick.hp,
      maxHp: brick.maxHp,
      armor: brick.armor,
      baseDamage: brick.baseDamage,
      physicalSize: brick.physicalSize,
      data: brick,
    };
  }
}
