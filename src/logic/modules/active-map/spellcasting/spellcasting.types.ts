import type { SpellConfig, SpellId, SpellDamageConfig } from "../../../../db/spells-db";
import type { ResourceAmountMap } from "@shared/types/resources";
import type { DataBridge } from "../../../core/DataBridge";
import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { BricksModule } from "../bricks/bricks.module";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { ExplosionModule } from "../../scene/explosion/explosion.module";
import type { MapRunState } from "../map/MapRunState";
import type { UnitProjectileController } from "../projectiles/ProjectileController";
import type { SkillId } from "../../../../db/skills-db";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";

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
  projectiles: UnitProjectileController;
  getSkillLevel: (id: SkillId) => number;
  runState: MapRunState;
}

export interface SpellcastingModuleUiApi {
  tryCastSpell(spellId: SpellId, rawTarget: SceneVector2): boolean;
}

declare module "@/logic/core/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    spellcasting: SpellcastingModuleUiApi;
  }
}
