import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { AbilityVisualService } from "./abilities/AbilityVisualService";
import type { AbilitySoundId } from "./abilities/ability.types";
import {
  AbilityCandidate,
  AbilityDescription,
  AbilityInitializationResult,
  AbilityRuntimeDependencies,
  AbilityStateBase,
  AbilityCooldownState,
} from "./abilities/ability.types";
import {
  PLAYER_UNIT_ABILITY_DEFINITIONS,
  PlayerUnitAbilityState,
} from "./abilities";
import { getUnitModuleConfig, UnitModuleId } from "../../../../db/unit-modules-db";
import type { SkillId } from "../../../../db/skills-db";
import {
  DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS,
} from "./abilities/ability.const";
import { UnitProjectileController } from "../projectiles/ProjectileController";
import type { SoundEffectPlayer } from "../../shared/audio/audio.types";
import type { StatusEffectsModule } from "../status-effects/status-effects.module";

// Re-export for backward compatibility
export type AbilitySoundPlayer = SoundEffectPlayer;

const ABILITY_SOUND_URLS: Record<AbilitySoundId, string> = {
  heal: "/audio/sounds/brick_effects/heal.mp3",
  frenzy: "/audio/sounds/brick_effects/buff.mp3",
  fireball: "/audio/sounds/brick_effects/fireball.mp3",
  tailNeedle: "/audio/sounds/brick_effects/fireball.mp3", // TODO: Add specific sound if needed
};

interface PlayerUnitAbilitiesOptions {
  sceneService: AbilityVisualService;
  statusEffects: StatusEffectsModule;
  logEvent: (message: string) => void;
  formatUnitLabel: (unit: PlayerUnitAbilityState) => string;
  getUnits: () => readonly PlayerUnitAbilityState[];
  getUnitById: (id: string) => PlayerUnitAbilityState | undefined;
  getBrickPosition: (brickId: string) => SceneVector2 | null;
  damageBrick: (brickId: string, damage: number) => void;
  getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  damageUnit: (unitId: string, damage: number) => void;
  findNearestBrick: (position: SceneVector2) => string | null;
  audio?: AbilitySoundPlayer;
  projectiles?: UnitProjectileController;
}

export interface AbilityActivationResult {
  abilityId: AbilitySoundId;
  statsChanged: boolean;
}

interface AbilityRuntimeEntry {
  definition: AbilityDescription<any, any>;
  state: AbilityStateBase;
  cooldownKey: string;
  cooldownSeconds: number;
}

interface UnitAbilityRuntime {
  abilities: Map<string, AbilityRuntimeEntry>;
  cooldowns: Map<string, AbilityCooldownState>;
}

export class PlayerUnitAbilities {
  private readonly visuals: AbilityVisualService;
  private readonly definitions: readonly AbilityDescription<any, any>[];
  private readonly logEvent: (message: string) => void;
  private readonly formatUnitLabel: (unit: PlayerUnitAbilityState) => string;
  private readonly getUnits: () => readonly PlayerUnitAbilityState[];
  private readonly getUnitById: (id: string) => PlayerUnitAbilityState | undefined;
  private readonly getBrickPosition: (brickId: string) => SceneVector2 | null;
  private readonly damageBrick: (brickId: string, damage: number) => void;
  private readonly getBricksInRadius: (position: SceneVector2, radius: number) => string[];
  private readonly damageUnit: (unitId: string, damage: number) => void;
  private readonly findNearestBrick: (position: SceneVector2) => string | null;
  private readonly audio?: AbilitySoundPlayer;
  private readonly dependencies: AbilityRuntimeDependencies;
  private readonly statusEffects: StatusEffectsModule;
  private unitStates = new Map<string, UnitAbilityRuntime>();

  constructor(options: PlayerUnitAbilitiesOptions) {
    this.visuals = options.sceneService;
    this.statusEffects = options.statusEffects;
    this.definitions = PLAYER_UNIT_ABILITY_DEFINITIONS;
    this.logEvent = options.logEvent;
    this.formatUnitLabel = options.formatUnitLabel;
    this.getUnits = options.getUnits;
    this.getUnitById = options.getUnitById;
    this.getBrickPosition = options.getBrickPosition;
    this.damageBrick = options.damageBrick;
    this.getBricksInRadius = options.getBricksInRadius;
    this.damageUnit = options.damageUnit;
    this.findNearestBrick = options.findNearestBrick;
    this.audio = options.audio;

    this.dependencies = {
      logEvent: this.logEvent,
      formatUnitLabel: this.formatUnitLabel,
      getUnits: this.getUnits,
      getUnitById: this.getUnitById,
      getBrickPosition: this.getBrickPosition,
      damageBrick: this.damageBrick,
      getBricksInRadius: this.getBricksInRadius,
      damageUnit: this.damageUnit,
      findNearestBrick: this.findNearestBrick,
      projectiles: options.projectiles,
      statusEffects: this.statusEffects,
    };
  }

  public resetRun(): void {
    this.visuals.reset();
    this.unitStates.clear();
    this.getUnits().forEach((unit) => {
      this.unitStates.set(unit.id, this.createUnitRuntime(unit));
    });
  }

  public update(deltaMs: number): void {
    this.visuals.update(deltaMs, this.getUnitById);
  }

  public clearArcEffects(): void {
    this.visuals.reset();
    this.unitStates.clear();
  }

  public processUnitAbilities(
    unit: PlayerUnitAbilityState,
    deltaSeconds: number,
    event: "tick" | "hit" = "tick",
    attackContext?: {
      attackDirection: SceneVector2;
      inflictedDamage: number;
      totalDamage: number;
    },
  ): AbilityActivationResult | null {
    const runtime = this.ensureUnitRuntime(unit);
    this.advanceCooldowns(runtime, deltaSeconds);

    const candidates = this.collectAbilityCandidates(unit, runtime, event, attackContext);
    if (candidates.length === 0) {
      return null;
    }

    let best = candidates[0]!;
    let bestScore = best.candidate.score;
    let bestPriority = best.candidate.priority ?? 0;

    for (let i = 1; i < candidates.length; i += 1) {
      const entry = candidates[i]!;
      const score = entry.candidate.score;
      const priority = entry.candidate.priority ?? 0;
      if (score > bestScore || (score === bestScore && priority > bestPriority)) {
        best = entry;
        bestScore = score;
        bestPriority = priority;
      }
    }

    if (bestScore <= 0) {
      return null;
    }

    const { runtimeEntry, cooldown, candidate } = best;
    const executionContext = {
      unit,
      state: runtimeEntry.state,
      cooldown: { remaining: cooldown.remaining, duration: runtimeEntry.cooldownSeconds },
      services: this.visuals,
      dependencies: this.dependencies,
      target: candidate.target,
      event,
      attackDirection: attackContext?.attackDirection,
      inflictedDamage: attackContext?.inflictedDamage,
      totalDamage: attackContext?.totalDamage,
    };

    const result = runtimeEntry.definition.execute(executionContext as never);
    if (!result.success) {
      return null;
    }

    cooldown.remaining = Math.max(runtimeEntry.cooldownSeconds, 0);
    if (typeof runtimeEntry.state.chargesRemaining === "number") {
      runtimeEntry.state.chargesRemaining = Math.max(
        0,
        runtimeEntry.state.chargesRemaining - 1,
      );
    }
    unit.timeSinceLastSpecial = 0;

    const soundId = result.soundId ?? runtimeEntry.definition.abilityId;
    this.playAbilitySound(soundId);

    return {
      abilityId: runtimeEntry.definition.abilityId,
      statsChanged: result.statsChanged ?? false,
    };
  }

  public processUnitAbilitiesOnAttack(
    unit: PlayerUnitAbilityState,
    attackDirection: SceneVector2,
    inflictedDamage: number,
    totalDamage: number,
  ): void {
    this.processUnitAbilities(unit, 0, "hit", {
      attackDirection,
      inflictedDamage,
      totalDamage,
    });
  }

  public consumeAttackBonuses(unit: PlayerUnitAbilityState): number {
    return this.statusEffects.consumeAttackBonus(unit.id);
  }

  public getAbilityCooldownSeconds(): number {
    return DEFAULT_PHEROMONE_IDLE_THRESHOLD_SECONDS;
  }

  private collectAbilityCandidates(
    unit: PlayerUnitAbilityState,
    runtime: UnitAbilityRuntime,
    event: "tick" | "hit" = "tick",
    attackContext?: {
      attackDirection: SceneVector2;
      inflictedDamage: number;
      totalDamage: number;
    },
  ): Array<{
    runtimeEntry: AbilityRuntimeEntry;
    cooldown: AbilityCooldownState;
    candidate: AbilityCandidate<any>;
  }> {
    const results: Array<{
      runtimeEntry: AbilityRuntimeEntry;
      cooldown: AbilityCooldownState;
      candidate: AbilityCandidate<any>;
    }> = [];

    runtime.abilities.forEach((entry) => {
      const cooldown = runtime.cooldowns.get(entry.cooldownKey);
      if (!cooldown) {
        return;
      }
      if (cooldown.remaining > 0) {
        return;
      }
      if (
        typeof entry.state.chargesRemaining === "number" &&
        entry.state.chargesRemaining <= 0
      ) {
        return;
      }

      const evaluationContext = {
        unit,
        state: entry.state,
        cooldown: { remaining: cooldown.remaining, duration: entry.cooldownSeconds },
        services: this.visuals,
        dependencies: this.dependencies,
        event,
        attackDirection: attackContext?.attackDirection,
        inflictedDamage: attackContext?.inflictedDamage,
        totalDamage: attackContext?.totalDamage,
      };

      const candidate = entry.definition.evaluate(evaluationContext as never);
      if (candidate) {
        results.push({
          runtimeEntry: entry,
          cooldown,
          candidate: candidate as AbilityCandidate<any>,
        });
      }
    });

    return results;
  }

  private ensureUnitRuntime(unit: PlayerUnitAbilityState): UnitAbilityRuntime {
    let runtime = this.unitStates.get(unit.id);
    if (!runtime) {
      runtime = this.createUnitRuntime(unit);
      this.unitStates.set(unit.id, runtime);
    }
    return runtime;
  }

  private createUnitRuntime(unit: PlayerUnitAbilityState): UnitAbilityRuntime {
    const runtime: UnitAbilityRuntime = {
      abilities: new Map(),
      cooldowns: new Map(),
    };

    this.definitions.forEach((definition) => {
      const initialized = this.initializeAbilityState(unit, definition);
      if (!initialized) {
        return;
      }
      const { state, cooldownKey, cooldownSeconds } = initialized;
      runtime.abilities.set(definition.abilityId, {
        definition,
        state,
        cooldownKey,
        cooldownSeconds,
      });
      this.ensureCooldown(runtime, cooldownKey, cooldownSeconds);
    });

    return runtime;
  }

  private initializeAbilityState(
    unit: PlayerUnitAbilityState,
    definition: AbilityDescription<any, any>,
  ): (AbilityInitializationResult<AbilityStateBase> & { cooldownKey: string }) | null {
    const context = {
      unit,
      hasModule: (moduleId: UnitModuleId) => unit.equippedModules.includes(moduleId),
      hasSkill: (skillId: SkillId) => unit.ownedSkills.includes(skillId),
      getModuleMeta: (moduleId: UnitModuleId) => this.safeGetModuleMeta(moduleId),
    };

    const initialized = definition.createState(context);
    if (!initialized) {
      return null;
    }
    const cooldownKey = initialized.sharedCooldownKey ?? definition.sharedCooldownKey ?? definition.abilityId;
    const cooldownSeconds = Math.max(initialized.cooldownSeconds, 0);
    return {
      ...initialized,
      cooldownSeconds,
      cooldownKey,
    };
  }

  private ensureCooldown(
    runtime: UnitAbilityRuntime,
    key: string,
    duration: number,
  ): AbilityCooldownState {
    const existing = runtime.cooldowns.get(key);
    if (existing) {
      existing.duration = Math.max(0, Math.min(existing.duration, duration));
      existing.remaining = Math.min(existing.remaining, existing.duration);
      return existing;
    }
    const cooldown: AbilityCooldownState = {
      key,
      duration: Math.max(0, duration),
      remaining: 0,
    };
    runtime.cooldowns.set(key, cooldown);
    return cooldown;
  }

  private advanceCooldowns(runtime: UnitAbilityRuntime, deltaSeconds: number): void {
    const decrement = Math.max(deltaSeconds, 0);
    runtime.cooldowns.forEach((cooldown) => {
      if (cooldown.remaining > 0) {
        cooldown.remaining = Math.max(0, cooldown.remaining - decrement);
      }
    });
  }

  private playAbilitySound(trigger: AbilitySoundId): void {
    const audio = this.audio;
    if (!audio) {
      return;
    }
    const url = ABILITY_SOUND_URLS[trigger];
    if (!url) {
      return;
    }
    audio.playSoundEffect(url);
  }

  private safeGetModuleMeta(moduleId: UnitModuleId) {
    try {
      return getUnitModuleConfig(moduleId).meta;
    } catch {
      return undefined;
    }
  }
}

export type { PlayerUnitAbilityState } from "./abilities";
