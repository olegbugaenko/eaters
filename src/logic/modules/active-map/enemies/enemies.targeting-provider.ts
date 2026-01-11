import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { TargetSnapshot, TargetingFilter, TargetingProvider } from "../targeting/targeting.types";
import type { EnemyRuntimeState } from "./enemies.types";
import { EnemiesModule } from "./enemies.module";

export class EnemyTargetingProvider implements TargetingProvider<"enemy", EnemyRuntimeState> {
  public readonly types = ["enemy"] as const;

  constructor(private readonly enemies: EnemiesModule) {}

  public getById(id: string): TargetSnapshot<"enemy", EnemyRuntimeState> | null {
    const enemy = this.enemies.getEnemyState(id);
    return enemy ? this.toTarget(enemy) : null;
  }

  public findNearest(
    position: SceneVector2,
    _filter?: TargetingFilter,
  ): TargetSnapshot<"enemy", EnemyRuntimeState> | null {
    const enemy = this.enemies.findNearestEnemy(position);
    return enemy ? this.toTarget(enemy) : null;
  }

  public findInRadius(
    position: SceneVector2,
    radius: number,
    _filter?: TargetingFilter,
  ): TargetSnapshot<"enemy", EnemyRuntimeState>[] {
    const enemies = this.enemies.findEnemiesNear(position, radius);
    return enemies.map((enemy) => this.toTarget(enemy));
  }

  public forEachInRadius(
    position: SceneVector2,
    radius: number,
    visitor: (target: TargetSnapshot<"enemy", EnemyRuntimeState>) => void,
    _filter?: TargetingFilter,
  ): void {
    this.enemies.forEachEnemyNear(position, radius, (enemy) => visitor(this.toTarget(enemy)));
  }

  private toTarget(enemy: EnemyRuntimeState): TargetSnapshot<"enemy", EnemyRuntimeState> {
    return {
      id: enemy.id,
      type: "enemy",
      position: enemy.position,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      armor: enemy.armor,
      baseDamage: enemy.baseDamage,
      physicalSize: enemy.physicalSize,
      data: enemy,
    };
  }
}
