import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { TargetingFilter, TargetingProvider } from "../targeting/targeting.types";
import type { PlayerUnitsModule } from "./player-units.module";
import type { PlayerUnitState } from "./units/UnitTypes";

export class PlayerUnitsTargetingProvider implements TargetingProvider<"unit", PlayerUnitState> {
  public readonly types = ["unit"] as const;

  constructor(private readonly module: PlayerUnitsModule) {}

  public getById(id: string) {
    const unit = this.module.getUnitState(id);
    return unit ? this.toSnapshot(unit) : null;
  }

  public findNearest(position: SceneVector2, _filter?: TargetingFilter) {
    const unit = this.module.findNearestUnit(position);
    return unit ? this.toSnapshot(unit) : null;
  }

  public findInRadius(position: SceneVector2, radius: number, _filter?: TargetingFilter) {
    return this.module.findUnitsNear(position, radius).map((unit) => this.toSnapshot(unit));
  }

  public forEachInRadius(
    position: SceneVector2,
    radius: number,
    visitor: (target: ReturnType<PlayerUnitsTargetingProvider["toSnapshot"]>) => void,
    _filter?: TargetingFilter,
  ): void {
    this.module.forEachUnitNear(position, radius, (unit) => visitor(this.toSnapshot(unit)));
  }

  private toSnapshot(unit: PlayerUnitState) {
    return {
      id: unit.id,
      type: "unit" as const,
      position: { ...unit.position },
      hp: unit.hp,
      maxHp: unit.maxHp,
      armor: unit.armor,
      baseDamage: unit.baseAttackDamage,
      physicalSize: unit.physicalSize,
      data: unit,
    };
  }
}
