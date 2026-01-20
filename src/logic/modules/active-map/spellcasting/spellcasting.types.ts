import type { SpellConfig, SpellId, SpellDamageConfig } from "../../../../db/spells-db";
import type { ResourceAmountMap } from "@shared/types/resources";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { BricksModule } from "../bricks/bricks.module";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { ArcModule } from "../../scene/arc/arc.module";
import type { MapRunState } from "../map/MapRunState";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import type { SkillId } from "../../../../db/skills-db";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DamageService } from "../targeting/DamageService";
import type { TargetingService } from "../targeting/TargetingService";

export interface SpellOptionBase {
  id: SpellId;
  type: SpellConfig["type"];
  name: string;
  description: string;
  cost: ResourceAmountMap;
  cooldownSeconds: number;
  remainingCooldownMs: number;
  spellPowerMultiplier: number;
}

export interface ProjectileSpellOption extends SpellOptionBase {
  type: "projectile";
  damage: SpellDamageConfig;
}

export interface WhirlSpellOption extends SpellOptionBase {
  type: "whirl";
  damagePerSecond: number;
  maxHealth: number;
  radius: number;
  speed: number;
}

export interface PersistentAoeSpellOption extends SpellOptionBase {
  type: "persistent-aoe";
  damagePerSecond: number;
  durationSeconds: number;
  startRadius: number;
  endRadius: number;
  thickness: number;
  damageReduction?: number; // Flat damage reduction from effects
  effectDurationSeconds?: number; // Duration of the effect on bricks
}

export type SpellOption =
  | ProjectileSpellOption
  | WhirlSpellOption
  | PersistentAoeSpellOption;

export interface SpellcastingModuleOptions {
  bridge: DataBridge;
  scene: SceneObjectManager;
  necromancer: NecromancerModule;
  bricks: BricksModule;
  bonuses: BonusesModule;
  explosions?: ExplosionModule;
  arcs?: ArcModule;
  projectiles: UnitProjectileController;
  damage: DamageService;
  targeting: TargetingService;
  getSkillLevel: (id: SkillId) => number;
  runState: MapRunState;
}

export interface SpellcastingModuleUiApi {
  tryCastSpell(spellId: SpellId, rawTarget: SceneVector2): boolean;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    spellcasting: SpellcastingModuleUiApi;
  }
}
