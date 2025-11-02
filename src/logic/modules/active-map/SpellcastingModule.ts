import { GameModule } from "../../core/types";
import { DataBridge } from "../../core/DataBridge";
import {
  FILL_TYPES,
  SceneColor,
  SceneObjectManager,
  SceneVector2,
} from "../../services/SceneObjectManager";
import { NecromancerModule } from "./NecromancerModule";
import { BricksModule } from "./BricksModule";
import {
  SpellConfig,
  SpellId,
  SpellProjectileRingTrailConfig,
  SpellDamageConfig,
  getSpellConfig,
  SPELL_IDS,
} from "../../../db/spells-db";
import { ResourceAmountMap } from "../../../types/resources";
import { BonusesModule, BonusValueMap } from "../shared/BonusesModule";
import { SkillId } from "../../../db/skills-db";

interface SpellOptionBase {
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

export type SpellOption = ProjectileSpellOption | WhirlSpellOption;

export const DEFAULT_SPELL_OPTIONS: SpellOption[] = [];

export const SPELL_OPTIONS_BRIDGE_KEY = "spellcasting/options";

interface SpellcastingModuleOptions {
  bridge: DataBridge;
  scene: SceneObjectManager;
  necromancer: NecromancerModule;
  bricks: BricksModule;
  bonuses: BonusesModule;
  getSkillLevel: (id: SkillId) => number;
}

interface SpellProjectileState {
  id: string;
  spellId: SpellId;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  elapsedMs: number;
  lifetimeMs: number;
  direction: SceneVector2;
  damage: Extract<SpellConfig, { type: "projectile" }>["damage"];
  ringTrail?: SpellProjectileRingTrailState;
  damageMultiplier: number;
}

interface SpellProjectileRingTrailState {
  config: SpellProjectileRingTrailRuntimeConfig;
  accumulatorMs: number;
}

interface SpellProjectileRingTrailRuntimeConfig
  extends Omit<SpellProjectileRingTrailConfig, "color"> {
  color: SceneColor;
}

interface SandStormState {
  id: string;
  spellId: SpellId;
  position: SceneVector2;
  velocity: SceneVector2;
  radius: number;
  baseDamagePerSecond: number;
  baseMaxHealth: number;
  maxHealth: number;
  remainingHealth: number;
  damageMultiplier: number;
  phase: number;
  spinSpeed: number;
}

interface SpellRingState {
  id: string;
  position: SceneVector2;
  elapsedMs: number;
  lifetimeMs: number;
  startRadius: number;
  endRadius: number;
  startAlpha: number;
  endAlpha: number;
  innerStop: number;
  outerStop: number;
  outerFadeStop: number;
  color: SceneColor;
}

const MAX_PROJECTILE_STEPS_PER_TICK = 5;
const MIN_MOVEMENT_STEP = 2;

const cloneCost = (cost: ResourceAmountMap): ResourceAmountMap => ({
  mana: Number.isFinite(cost.mana) ? cost.mana : 0,
  sanity: Number.isFinite(cost.sanity) ? cost.sanity : 0,
});

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

const randomDamage = (
  config: Extract<SpellConfig, { type: "projectile" }>["damage"],
): number => {
  const min = Math.max(0, Math.floor(config.min));
  const max = Math.max(min, Math.floor(config.max));
  if (max <= min) {
    return min;
  }
  const range = max - min + 1;
  return min + Math.floor(Math.random() * range);
};

export class SpellcastingModule implements GameModule {
  public readonly id = "spellcasting";

  private readonly bridge: DataBridge;
  private readonly scene: SceneObjectManager;
  private readonly necromancer: NecromancerModule;
  private readonly bricks: BricksModule;
  private readonly bonuses: BonusesModule;
  private readonly configs = new Map<SpellId, SpellConfig>();
  private readonly cooldowns = new Map<SpellId, number>();

  private projectiles: SpellProjectileState[] = [];
  private storms: SandStormState[] = [];
  private rings: SpellRingState[] = [];
  private optionsDirty = true;
  private spellPowerMultiplier = 1;
  private readonly getSkillLevel: (id: SkillId) => number;
  private readonly unlockedSpells = new Map<SpellId, boolean>();

  constructor(options: SpellcastingModuleOptions) {
    this.bridge = options.bridge;
    this.scene = options.scene;
    this.necromancer = options.necromancer;
    this.bricks = options.bricks;
    this.bonuses = options.bonuses;
    this.getSkillLevel = options.getSkillLevel;

    SPELL_IDS.forEach((id) => {
      const config = getSpellConfig(id);
      this.configs.set(id, config);
      this.cooldowns.set(id, 0);
      this.unlockedSpells.set(id, false);
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
    this.clearProjectiles();
    this.clearStorms();
    this.clearRings();
    this.refreshSpellUnlocks();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public load(_data: unknown | undefined): void {
    this.cooldowns.forEach((_, id) => this.cooldowns.set(id, 0));
    this.clearProjectiles();
    this.clearStorms();
    this.clearRings();
    this.refreshSpellUnlocks();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    const unlockChanged = this.refreshSpellUnlocks();
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
      if (this.projectiles.length > 0) {
        this.clearProjectiles();
      }
      if (this.storms.length > 0) {
        this.clearStorms();
      }
      if (this.rings.length > 0) {
        this.clearRings();
      }
    } else {
      if (this.projectiles.length > 0) {
        this.updateProjectiles(delta);
      }
      if (this.storms.length > 0) {
        this.updateStorms(delta);
      }
      if (this.rings.length > 0) {
        this.updateRings(delta);
      }
    }

    if (cooldownChanged || unlockChanged) {
      this.markOptionsDirty();
    }

    if (this.optionsDirty) {
      this.pushSpellOptions();
    }
  }

  public tryCastSpell(spellId: SpellId, rawTarget: SceneVector2): boolean {
    const config = this.configs.get(spellId);
    if (!config) {
      return false;
    }

    if (!this.isConfigUnlocked(config)) {
      return false;
    }

    if (!this.necromancer.isMapActive()) {
      return false;
    }

    const cooldown = this.cooldowns.get(spellId) ?? 0;
    if (cooldown > 0) {
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

    switch (config.type) {
      case "projectile":
        this.spawnProjectile(spellId, config, origin, direction);
        break;
      case "whirl":
        this.spawnSandStorm(spellId, config, origin, direction);
        break;
      default:
        return false;
    }
    this.cooldowns.set(spellId, Math.max(0, config.cooldownSeconds * 1000));
    this.markOptionsDirty();
    return true;
  }

  private spawnProjectile(
    spellId: SpellId,
    config: Extract<SpellConfig, { type: "projectile" }>,
    origin: SceneVector2,
    direction: SceneVector2,
  ): void {
    const velocity: SceneVector2 = {
      x: direction.x * config.projectile.speed,
      y: direction.y * config.projectile.speed,
    };

    const position = {
      x: origin.x + (config.projectile.spawnOffset?.x ?? 0),
      y: origin.y + (config.projectile.spawnOffset?.y ?? 0),
    };

    const objectId = this.scene.addObject("spellProjectile", {
      position: { ...position },
      size: { width: config.projectile.radius * 2, height: config.projectile.radius * 2 },
      rotation: Math.atan2(direction.y, direction.x),
      fill: config.projectile.fill,
      customData: {
        tail: config.projectile.tail,
        tailEmitter: config.projectile.tailEmitter,
      },
    });

    const ringTrail = config.projectile.ringTrail
      ? this.createRingTrailState(config.projectile.ringTrail)
      : undefined;

    const projectileState: SpellProjectileState = {
      id: objectId,
      spellId,
      position: { ...position },
      velocity,
      radius: config.projectile.radius,
      elapsedMs: 0,
      lifetimeMs: Math.max(0, config.projectile.lifetimeMs),
      direction: { ...direction },
      damage: config.damage,
      ringTrail,
      damageMultiplier: this.getSpellPowerMultiplier(),
    };

    this.projectiles.push(projectileState);

    if (ringTrail) {
      this.spawnProjectileRing(projectileState.position, ringTrail.config);
    }
  }

  private spawnSandStorm(
    spellId: SpellId,
    config: Extract<SpellConfig, { type: "whirl" }>,
    origin: SceneVector2,
    direction: SceneVector2,
  ): void {
    const whirl = config.whirl;
    const radius = Math.max(1, whirl.radius);
    const speed = Math.max(0, whirl.speed);
    const velocity: SceneVector2 = {
      x: direction.x * speed,
      y: direction.y * speed,
    };
    const position = { ...origin };
    const damageMultiplier = this.getSpellPowerMultiplier();
    const baseMaxHealth = Math.max(0, whirl.maxHealth);
    const maxHealth = baseMaxHealth * damageMultiplier;

    const objectId = this.scene.addObject("sandStorm", {
      position: { ...position },
      size: { width: radius * 2, height: radius * 2 },
      customData: {
        intensity: maxHealth > 0 ? 1 : 0,
        phase: 0,
      },
    });

    const state: SandStormState = {
      id: objectId,
      spellId,
      position,
      velocity,
      radius,
      baseDamagePerSecond: Math.max(0, whirl.damagePerSecond),
      baseMaxHealth,
      maxHealth,
      remainingHealth: maxHealth,
      damageMultiplier,
      phase: 0,
      spinSpeed: Math.max(0, whirl.spinSpeed ?? 2.5),
    };

    this.storms.push(state);
  }

  private updateProjectiles(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const mapSize = this.scene.getMapSize();
    const survivors: SpellProjectileState[] = [];

    this.projectiles.forEach((projectile) => {
      let hit = false;
      const totalMove = {
        x: projectile.velocity.x * deltaSeconds,
        y: projectile.velocity.y * deltaSeconds,
      };
      const distance = Math.hypot(totalMove.x, totalMove.y);
      const steps = Math.max(
        1,
        Math.min(
          MAX_PROJECTILE_STEPS_PER_TICK,
          Math.ceil(distance / Math.max(projectile.radius, MIN_MOVEMENT_STEP)),
        ),
      );
      const stepVector = {
        x: totalMove.x / steps,
        y: totalMove.y / steps,
      };

      for (let i = 0; i < steps; i += 1) {
        projectile.position = {
          x: projectile.position.x + stepVector.x,
          y: projectile.position.y + stepVector.y,
        };

        const collided = this.findHitBrick(projectile.position, projectile.radius);
        if (collided) {
          const baseDamage = randomDamage(projectile.damage);
          const damage = Math.max(baseDamage * Math.max(projectile.damageMultiplier, 0), 0);
          this.bricks.applyDamage(collided.id, damage, projectile.direction);
          this.scene.removeObject(projectile.id);
          if (projectile.ringTrail) {
            this.spawnProjectileRing(projectile.position, projectile.ringTrail.config);
          }
          hit = true;
          break;
        }
      }

      if (hit) {
        return;
      }

      projectile.elapsedMs += deltaMs;
      if (projectile.elapsedMs >= projectile.lifetimeMs) {
        this.scene.removeObject(projectile.id);
        return;
      }

      if (
        projectile.position.x + projectile.radius < 0 ||
        projectile.position.y + projectile.radius < 0 ||
        projectile.position.x - projectile.radius > mapSize.width ||
        projectile.position.y - projectile.radius > mapSize.height
      ) {
        this.scene.removeObject(projectile.id);
        return;
      }

      this.scene.updateObject(projectile.id, {
        position: { ...projectile.position },
        rotation: Math.atan2(projectile.velocity.y, projectile.velocity.x),
      });

      if (projectile.ringTrail) {
        this.updateProjectileRingTrail(projectile, deltaMs);
      }

      survivors.push(projectile);
    });

    this.projectiles = survivors;
  }

  private updateStorms(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const mapSize = this.scene.getMapSize();
    const survivors: SandStormState[] = [];

    this.storms.forEach((storm) => {
      storm.position = {
        x: storm.position.x + storm.velocity.x * deltaSeconds,
        y: storm.position.y + storm.velocity.y * deltaSeconds,
      };
      storm.phase += storm.spinSpeed * deltaSeconds;

      const outOfBounds =
        storm.position.x + storm.radius < 0 ||
        storm.position.y + storm.radius < 0 ||
        storm.position.x - storm.radius > mapSize.width ||
        storm.position.y - storm.radius > mapSize.height;

      if (outOfBounds) {
        this.scene.removeObject(storm.id);
        return;
      }

      const damage = Math.max(
        0,
        storm.baseDamagePerSecond * storm.damageMultiplier * deltaSeconds,
      );
      let inflictedTotal = 0;
      if (damage > 0) {
        const bricks = this.bricks.findBricksNear(storm.position, storm.radius);
        for (let i = 0; i < bricks.length; i += 1) {
          const brick = bricks[i]!;
          const beforeHp = Math.max(brick.hp, 0);
          if (beforeHp <= 0) {
            continue;
          }
          const direction = this.normalizeDirection({
            x: brick.position.x - storm.position.x,
            y: brick.position.y - storm.position.y,
          });
          const result = this.bricks.applyDamage(
            brick.id,
            damage,
            direction ?? { x: 0, y: 0 },
          );
          const afterHp = result.brick ? Math.max(result.brick.hp, 0) : 0;
          const inflicted = Math.min(beforeHp, Math.max(beforeHp - afterHp, 0));
          if (inflicted > 0) {
            inflictedTotal += inflicted;
          }
        }
      }

      if (inflictedTotal > 0) {
        storm.remainingHealth = Math.max(0, storm.remainingHealth - inflictedTotal);
      }

      if (storm.remainingHealth <= 0) {
        this.scene.removeObject(storm.id);
        return;
      }

      const intensityBase = storm.maxHealth > 0 ? storm.remainingHealth / storm.maxHealth : 0;
      const intensity = clampNumber(intensityBase, 0, 1);
      this.scene.updateObject(storm.id, {
        position: { ...storm.position },
        size: { width: storm.radius * 2, height: storm.radius * 2 },
        customData: {
          intensity: Math.max(0.25, intensity),
          phase: storm.phase,
        },
      });

      survivors.push(storm);
    });

    this.storms = survivors;
  }

  private findHitBrick(position: SceneVector2, radius: number) {
    const candidates = this.bricks.findBricksNear(position, radius + 12);
    if (candidates.length === 0) {
      return null;
    }

    let closest: { id: string; distance: number; size: number } | null = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const brick = candidates[i]!;
      const dx = brick.position.x - position.x;
      const dy = brick.position.y - position.y;
      const distance = Math.hypot(dx, dy);
      const combined = Math.max(0, (brick.physicalSize ?? 0) + radius);
      if (distance <= combined) {
        if (!closest || distance < closest.distance) {
          closest = { id: brick.id, distance, size: combined };
        }
      }
    }

    return closest;
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

  private clearProjectiles(): void {
    this.projectiles.forEach((projectile) => {
      this.scene.removeObject(projectile.id);
    });
    this.projectiles = [];
  }

  private clearStorms(): void {
    this.storms.forEach((storm) => {
      this.scene.removeObject(storm.id);
    });
    this.storms = [];
  }

  private clearRings(): void {
    this.rings.forEach((ring) => {
      this.scene.removeObject(ring.id);
    });
    this.rings = [];
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
        if (config.type === "projectile") {
          const projectileConfig = config as Extract<SpellConfig, { type: "projectile" }>;
          return {
            ...base,
            type: "projectile",
            damage: { ...projectileConfig.damage },
          } satisfies ProjectileSpellOption;
        }
        const whirlConfig = config as Extract<SpellConfig, { type: "whirl" }>;
        return {
          ...base,
          type: "whirl",
          damagePerSecond: whirlConfig.whirl.damagePerSecond,
          maxHealth: whirlConfig.whirl.maxHealth,
          radius: whirlConfig.whirl.radius,
          speed: whirlConfig.whirl.speed,
        } satisfies WhirlSpellOption;
      });
    this.bridge.setValue(SPELL_OPTIONS_BRIDGE_KEY, payload);
    this.optionsDirty = false;
  }

  private createRingTrailState(
    config: SpellProjectileRingTrailConfig
  ): SpellProjectileRingTrailState {
    const sanitized: SpellProjectileRingTrailRuntimeConfig = {
      spawnIntervalMs: Math.max(1, Math.floor(config.spawnIntervalMs)),
      lifetimeMs: Math.max(1, Math.floor(config.lifetimeMs)),
      startRadius: Math.max(1, config.startRadius),
      endRadius: Math.max(Math.max(1, config.startRadius), config.endRadius),
      startAlpha: clamp01(config.startAlpha),
      endAlpha: clamp01(config.endAlpha),
      innerStop: clamp01(config.innerStop),
      outerStop: clamp01(config.outerStop),
      color: {
        r: clamp01(config.color.r ?? 0),
        g: clamp01(config.color.g ?? 0),
        b: clamp01(config.color.b ?? 0),
        a: clamp01(config.color.a ?? 1),
      },
    };

    if (sanitized.outerStop <= sanitized.innerStop) {
      sanitized.outerStop = Math.min(1, sanitized.innerStop + 0.1);
    }

    return {
      config: sanitized,
      accumulatorMs: 0,
    };
  }

  private updateProjectileRingTrail(
    projectile: SpellProjectileState,
    deltaMs: number
  ): void {
    const trail = projectile.ringTrail;
    if (!trail) {
      return;
    }
    const interval = Math.max(1, trail.config.spawnIntervalMs);
    trail.accumulatorMs += deltaMs;
    while (trail.accumulatorMs >= interval) {
      trail.accumulatorMs -= interval;
      this.spawnProjectileRing(projectile.position, trail.config);
    }
  }

  private spawnProjectileRing(
    position: SceneVector2,
    config: SpellProjectileRingTrailRuntimeConfig
  ): void {
    const innerStop = clamp01(config.innerStop);
    let outerStop = clamp01(config.outerStop);
    if (outerStop <= innerStop) {
      outerStop = Math.min(1, innerStop + 0.1);
    }
    const outerFadeStop = Math.min(1, outerStop + 0.15);
    const ring: SpellRingState = {
      id: this.scene.addObject("spellProjectileRing", {
        position: { ...position },
        size: {
          width: config.startRadius * 2,
          height: config.startRadius * 2,
        },
        fill: createRingFill(config.startRadius, config.startAlpha, {
          color: config.color,
          innerStop,
          outerStop,
          outerFadeStop,
        }),
      }),
      position: { ...position },
      elapsedMs: 0,
      lifetimeMs: config.lifetimeMs,
      startRadius: config.startRadius,
      endRadius: config.endRadius,
      startAlpha: config.startAlpha,
      endAlpha: config.endAlpha,
      innerStop,
      outerStop,
      outerFadeStop,
      color: { ...config.color },
    };

    this.rings.push(ring);
  }

  private updateRings(deltaMs: number): void {
    if (deltaMs <= 0) {
      return;
    }
    const survivors: SpellRingState[] = [];
    this.rings.forEach((ring) => {
      ring.elapsedMs += deltaMs;
      const lifetime = Math.max(1, ring.lifetimeMs);
      if (ring.elapsedMs >= lifetime) {
        this.scene.removeObject(ring.id);
        return;
      }
      const progress = clamp01(ring.elapsedMs / lifetime);
      const radius = lerp(ring.startRadius, ring.endRadius, progress);
      const alpha = lerp(ring.startAlpha, ring.endAlpha, progress);
      if (alpha <= 0.001) {
        this.scene.removeObject(ring.id);
        return;
      }
      this.scene.updateObject(ring.id, {
        position: { ...ring.position },
        size: { width: radius * 2, height: radius * 2 },
        fill: createRingFill(radius, alpha, ring),
      });
      survivors.push(ring);
    });
    this.rings = survivors;
  }

  private handleBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
    this.projectiles.forEach((projectile) => {
      projectile.damageMultiplier = sanitized;
    });
    this.storms.forEach((storm) => {
      const previousMax = storm.maxHealth;
      storm.damageMultiplier = sanitized;
      storm.maxHealth = storm.baseMaxHealth * sanitized;
      if (storm.maxHealth <= 0) {
        storm.remainingHealth = 0;
        return;
      }
      if (previousMax <= 0) {
        storm.remainingHealth = storm.maxHealth;
        return;
      }
      const ratio = clampNumber(previousMax > 0 ? storm.remainingHealth / previousMax : 0, 0, 1);
      storm.remainingHealth = clampNumber(ratio * storm.maxHealth, 0, storm.maxHealth);
    });
    this.markOptionsDirty();
  }

  private getSpellPowerMultiplier(): number {
    return this.spellPowerMultiplier;
  }
}

const clamp01 = (value: number): number => clampNumber(value, 0, 1);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp01(t);

const createRingFill = (
  radius: number,
  alpha: number,
  params: {
    color: SceneColor;
    innerStop: number;
    outerStop: number;
    outerFadeStop: number;
  }
) => ({
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: radius,
  stops: [
    { offset: 0, color: { ...params.color, a: 0 } },
    { offset: params.innerStop, color: { ...params.color, a: 0 } },
    { offset: params.outerStop, color: { ...params.color, a: clamp01(alpha) } },
    { offset: params.outerFadeStop, color: { ...params.color, a: 0 } },
    { offset: 1, color: { ...params.color, a: 0 } },
  ],
});
