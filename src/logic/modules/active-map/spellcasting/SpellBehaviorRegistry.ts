import { SpellConfig } from "../../../../db/spells-db";
import { SpellBehavior, SpellBehaviorDependencies } from "./SpellBehavior";
import { ProjectileSpellBehavior } from "./implementations/ProjectileSpellBehavior";
import { WhirlSpellBehavior } from "./implementations/WhirlSpellBehavior";
import { PersistentAoeSpellBehavior } from "./implementations/PersistentAoeSpellBehavior";

export class SpellBehaviorRegistry {
  private readonly behaviors = new Map<SpellConfig["type"], SpellBehavior>();

  constructor(dependencies: SpellBehaviorDependencies) {
    this.behaviors.set("projectile", new ProjectileSpellBehavior(dependencies));
    this.behaviors.set("whirl", new WhirlSpellBehavior(dependencies));
    this.behaviors.set("persistent-aoe", new PersistentAoeSpellBehavior(dependencies));
  }

  public getBehavior(type: SpellConfig["type"]): SpellBehavior | undefined {
    return this.behaviors.get(type);
  }

  public getAllBehaviors(): SpellBehavior[] {
    return Array.from(this.behaviors.values());
  }

  public register(type: SpellConfig["type"], behavior: SpellBehavior): void {
    this.behaviors.set(type, behavior);
  }
}

