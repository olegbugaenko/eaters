import { GameModule } from "@core/logic/types";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import {
  SpellConfig,
  SpellId,
  getSpellConfig,
  SPELL_IDS,
} from "../../../../db/spells-db";
import { SkillId } from "../../../../db/skills-db";
import { ResourceAmountMap } from "@shared/types/resources";
import { BonusesModule } from "../../shared/bonuses/bonuses.module";
import type { BonusValueMap } from "../../shared/bonuses/bonuses.types";
import type { BricksModule } from "../bricks/bricks.module";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { MapRunState } from "../map/MapRunState";
import { SpellBehaviorRegistry } from "./SpellBehaviorRegistry";
import { SpellCastContext, SpellCanCastContext } from "./SpellBehavior";
import { clampNumber } from "@shared/helpers/numbers.helper";
import type {
  SpellOption,
  SpellOptionBase,
  ProjectileSpellOption,
  WhirlSpellOption,
  PersistentAoeSpellOption,
  SpellcastingModuleOptions,
} from "./spellcasting.types";
import {
  DEFAULT_SPELL_OPTIONS,
  SPELL_OPTIONS_BRIDGE_KEY,
} from "./spellcasting.const";

const cloneCost = (cost: ResourceAmountMap): ResourceAmountMap => ({
  mana: Number.isFinite(cost.mana) ? cost.mana : 0,
  sanity: Number.isFinite(cost.sanity) ? cost.sanity : 0,
});

export class SpellcastingModule implements GameModule {
  public readonly id = "spellcasting";

  private readonly bridge: DataBridge;
  private readonly scene: SceneObjectManager;
  private readonly necromancer: NecromancerModule;
  private readonly bricks: BricksModule;
  private readonly bonuses: BonusesModule;
  private readonly configs = new Map<SpellId, SpellConfig>();
  private readonly cooldowns = new Map<SpellId, number>();
  private readonly behaviorRegistry: SpellBehaviorRegistry;
  private optionsDirty = true;
  private spellPowerMultiplier = 1;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly unlockedSpells = new Map<SpellId, boolean>();
  private readonly runState: MapRunState;

  constructor(options: SpellcastingModuleOptions) {
    this.bridge = options.bridge;
    this.scene = options.scene;
    this.necromancer = options.necromancer;
    this.bricks = options.bricks;
    this.bonuses = options.bonuses;
    this.runState = options.runState;
    this.getSkillLevel = options.getSkillLevel;

    SPELL_IDS.forEach((id) => {
      const config = getSpellConfig(id);
      this.configs.set(id, config);
      this.cooldowns.set(id, 0);
      this.unlockedSpells.set(id, false);
    });

    this.behaviorRegistry = new SpellBehaviorRegistry({
      scene: this.scene,
      bricks: this.bricks,
      bonuses: this.bonuses,
      explosions: options.explosions,
      projectiles: options.projectiles,
      damage: options.damage,
      targeting: options.targeting,
      getSpellPowerMultiplier: () => this.spellPowerMultiplier,
    });

    this.bonuses.subscribe((values) => {
      this.handleBonusValuesChanged(values);
    });
  }

  public initialize(): void {
    this.handleBonusValuesChanged(this.bonuses.getAllValues());
    this.refreshSpellUnlocks();
    this.pushSpellOptions();
  }

  public reset(): void {
    this.cooldowns.forEach((_, id) => this.cooldowns.set(id, 0));
    this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
      behavior.clear();
    });
    this.refreshSpellUnlocks();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public load(_data: unknown | undefined): void {
    this.cooldowns.forEach((_, id) => this.cooldowns.set(id, 0));
    this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
      behavior.clear();
    });
    this.refreshSpellUnlocks();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    const unlockChanged = this.refreshSpellUnlocks();
    if (!this.runState.shouldProcessTick()) {
      if (unlockChanged) {
        this.markOptionsDirty();
      }
      if (this.optionsDirty) {
        this.pushSpellOptions();
      }
      return;
    }
    if (deltaMs <= 0) {
      if (unlockChanged) {
        this.markOptionsDirty();
      }
      if (this.optionsDirty) {
        this.pushSpellOptions();
      }
      return;
    }

    const delta = Math.max(0, deltaMs);
    let cooldownChanged = false;
    this.cooldowns.forEach((remaining, id) => {
      if (remaining <= 0) {
        return;
      }
      const next = Math.max(remaining - delta, 0);
      if (next !== remaining) {
        this.cooldowns.set(id, next);
        cooldownChanged = true;
      }
    });

    if (!this.necromancer.isMapActive()) {
      this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
        behavior.clear();
      });
    } else {
      this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
        behavior.tick(delta);
      });
    }

    if (cooldownChanged || unlockChanged) {
      this.markOptionsDirty();
    }

    if (this.optionsDirty) {
      this.pushSpellOptions();
    }
  }

  public cleanupExpired(): void {
    // Clean up expired spell effects (projectiles, AOE, storms, etc.)
    this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
      if (typeof behavior.cleanupExpired === "function") {
        behavior.cleanupExpired();
      }
    });
  }

  public hasResourcesForAnySpell(): boolean {
    if (!this.necromancer.isMapActive()) {
      return false;
    }
    const resources = this.necromancer.getResources();
    return SPELL_IDS.some((id) => {
      const config = this.configs.get(id);
      if (!config) {
        return false;
      }
      if (!this.isConfigUnlocked(config)) {
        return false;
      }
      const cooldown = this.cooldowns.get(id) ?? 0;
      if (cooldown > 0) {
        return false;
      }
      const behavior = this.behaviorRegistry.getBehavior(config.type);
      if (!behavior) {
        return false;
      }
      const canCastContext: SpellCanCastContext = {
        spellId: id,
        config,
        cooldownRemainingMs: cooldown,
        isMapActive: true,
        isUnlocked: true,
      };
      if (!behavior.canCast(canCastContext)) {
        return false;
      }
      const cost = cloneCost(config.cost);
      return resources.mana.current >= cost.mana;
    });
  }

  public tryCastSpell(spellId: SpellId, rawTarget: SceneVector2): boolean {
    const config = this.configs.get(spellId);
    if (!config) {
      return false;
    }

    const behavior = this.behaviorRegistry.getBehavior(config.type);
    if (!behavior) {
      return false;
    }

    const isUnlocked = this.isConfigUnlocked(config);
    const cooldown = this.cooldowns.get(spellId) ?? 0;
    const isMapActive = this.necromancer.isMapActive();

    const canCastContext: SpellCanCastContext = {
      spellId,
      config,
      cooldownRemainingMs: cooldown,
      isMapActive,
      isUnlocked,
    };

    if (!behavior.canCast(canCastContext)) {
      return false;
    }

    const target = this.clampToMap(rawTarget);
    const origin = this.getSpellOrigin(target);
    if (!origin) {
      return false;
    }

    const direction = this.normalizeDirection({
      x: target.x - origin.x,
      y: target.y - origin.y,
    });
    if (!direction) {
      return false;
    }

    const cost = cloneCost(config.cost);
    if (!this.necromancer.tryConsumeResources(cost)) {
      return false;
    }

    const castContext: SpellCastContext = {
      spellId,
      config,
      origin,
      target,
      direction,
      spellPowerMultiplier: this.spellPowerMultiplier,
    };

    if (!behavior.cast(castContext)) {
      return false;
    }

    this.cooldowns.set(spellId, Math.max(0, config.cooldownSeconds * 1000));
    this.markOptionsDirty();
    return true;
  }


  private getSpellOrigin(target: SceneVector2): SceneVector2 | null {
    const spawnPoints = this.necromancer.getSpawnPoints();
    if (spawnPoints.length === 0) {
      const map = this.scene.getMapSize();
      return {
        x: clampNumber(map.width / 2, 0, map.width),
        y: clampNumber(map.height / 2, 0, map.height),
      };
    }
    let best: SceneVector2 | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < spawnPoints.length; i += 1) {
      const point = spawnPoints[i]!;
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDist) {
        bestDist = distSq;
        best = point;
      }
    }
    return best ? { ...best } : null;
  }

  private normalizeDirection(vector: SceneVector2): SceneVector2 | null {
    const length = Math.hypot(vector.x, vector.y);
    if (!Number.isFinite(length) || length <= 0) {
      return null;
    }
    return { x: vector.x / length, y: vector.y / length };
  }

  private clampToMap(position: SceneVector2): SceneVector2 {
    const mapSize = this.scene.getMapSize();
    return {
      x: clampNumber(position.x, 0, mapSize.width),
      y: clampNumber(position.y, 0, mapSize.height),
    };
  }

  private markOptionsDirty(): void {
    this.optionsDirty = true;
  }

  private refreshSpellUnlocks(): boolean {
    let changed = false;
    SPELL_IDS.forEach((id) => {
      const config = this.configs.get(id);
      if (!config) {
        return;
      }
      const unlocked = this.isConfigUnlocked(config);
      if (this.unlockedSpells.get(id) !== unlocked) {
        this.unlockedSpells.set(id, unlocked);
        if (!unlocked) {
          this.cooldowns.set(id, 0);
        }
        changed = true;
      }
    });
    return changed;
  }

  private isConfigUnlocked(config: SpellConfig): boolean {
    const requirement = config.unlock;
    if (!requirement) {
      return true;
    }
    const level = Math.max(0, Math.floor(requirement.level));
    return this.getSkillLevel(requirement.skillId) >= level;
  }

  private pushSpellOptions(): void {
    const payload: SpellOption[] = SPELL_IDS.filter((id) => this.unlockedSpells.get(id))
      .map((id) => {
        const config = this.configs.get(id)!;
        const base: SpellOptionBase = {
          id,
          type: config.type,
          name: config.name,
          description: config.description,
          cost: cloneCost(config.cost),
          cooldownSeconds: config.cooldownSeconds,
          remainingCooldownMs: Math.max(0, this.cooldowns.get(id) ?? 0),
          spellPowerMultiplier: this.getSpellPowerMultiplier(),
        };

        switch (config.type) {
          case "projectile": {
            const projectileConfig = config as Extract<SpellConfig, { type: "projectile" }>;
            return {
              ...base,
              type: "projectile",
              damage: { ...projectileConfig.damage },
            } satisfies ProjectileSpellOption;
          }
          case "whirl": {
            const whirlConfig = config as Extract<SpellConfig, { type: "whirl" }>;
            return {
              ...base,
              type: "whirl",
              damagePerSecond: whirlConfig.whirl.damagePerSecond,
              maxHealth: whirlConfig.whirl.maxHealth,
              radius: whirlConfig.whirl.radius,
              speed: whirlConfig.whirl.speed,
            } satisfies WhirlSpellOption;
          }
          case "persistent-aoe": {
            const aoeConfig = config as Extract<SpellConfig, { type: "persistent-aoe" }>;
            const durationSeconds = Math.max(aoeConfig.persistentAoe.durationMs / 1000, 0);
            const ring = aoeConfig.persistentAoe.ring;
            // Calculate damage reduction and effect duration from effects
            let damageReduction = 0;
            let effectDurationMs = 0;
            const effects = aoeConfig.persistentAoe.effects;
            if (effects) {
              for (const effect of effects) {
                if (effect.type === "outgoing-damage-flat-reduction") {
                  damageReduction += effect.reductionValue;
                  effectDurationMs = Math.max(effectDurationMs, effect.durationMs);
                } else if (effect.type === "outgoing-damage-multiplier") {
                  effectDurationMs = Math.max(effectDurationMs, effect.durationMs);
                }
              }
            }
            return {
              ...base,
              type: "persistent-aoe",
              damagePerSecond: aoeConfig.persistentAoe.damagePerSecond,
              durationSeconds,
              startRadius: ring.startRadius,
              endRadius: ring.endRadius,
              thickness: ring.thickness,
              damageReduction: damageReduction > 0 ? damageReduction : undefined,
              effectDurationSeconds: effectDurationMs > 0 ? effectDurationMs / 1000 : undefined,
            } satisfies PersistentAoeSpellOption;
          }
          default:
            return base as SpellOption;
        }
      });
    DataBridgeHelpers.pushState(this.bridge, SPELL_OPTIONS_BRIDGE_KEY, payload);
    this.optionsDirty = false;
  }

  private handleBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    this.behaviorRegistry.getAllBehaviors().forEach((behavior) => {
      behavior.onBonusValuesChanged(values);
    });
    this.markOptionsDirty();
  }

  private getSpellPowerMultiplier(): number {
    return this.spellPowerMultiplier;
  }
}
