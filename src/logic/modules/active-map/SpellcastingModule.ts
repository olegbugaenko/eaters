import { GameModule } from "../../core/types";
import { DataBridge } from "../../core/DataBridge";
import { SceneObjectManager, SceneVector2 } from "../../services/SceneObjectManager";
import { NecromancerModule } from "./NecromancerModule";
import { BricksModule } from "./BricksModule";
import {
  SpellConfig,
  SpellId,
  getSpellConfig,
  SPELL_IDS,
} from "../../../db/spells-db";
import { ResourceAmountMap } from "../../../types/resources";

export interface SpellOption {
  id: SpellId;
  name: string;
  cost: ResourceAmountMap;
  cooldownSeconds: number;
  remainingCooldownMs: number;
}

export const DEFAULT_SPELL_OPTIONS: SpellOption[] = [];

export const SPELL_OPTIONS_BRIDGE_KEY = "spellcasting/options";

interface SpellcastingModuleOptions {
  bridge: DataBridge;
  scene: SceneObjectManager;
  necromancer: NecromancerModule;
  bricks: BricksModule;
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
  damage: SpellConfig["damage"];
}

const MAX_PROJECTILE_STEPS_PER_TICK = 5;
const MIN_MOVEMENT_STEP = 2;

const cloneCost = (cost: ResourceAmountMap): ResourceAmountMap => ({
  mana: Number.isFinite(cost.mana) ? cost.mana : 0,
  sanity: Number.isFinite(cost.sanity) ? cost.sanity : 0,
});

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

const randomDamage = (config: SpellConfig["damage"]): number => {
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
  private readonly configs = new Map<SpellId, SpellConfig>();
  private readonly cooldowns = new Map<SpellId, number>();

  private projectiles: SpellProjectileState[] = [];
  private optionsDirty = true;

  constructor(options: SpellcastingModuleOptions) {
    this.bridge = options.bridge;
    this.scene = options.scene;
    this.necromancer = options.necromancer;
    this.bricks = options.bricks;

    SPELL_IDS.forEach((id) => {
      this.configs.set(id, getSpellConfig(id));
      this.cooldowns.set(id, 0);
    });
  }

  public initialize(): void {
    this.pushSpellOptions();
  }

  public reset(): void {
    this.cooldowns.forEach((_, id) => this.cooldowns.set(id, 0));
    this.clearProjectiles();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public load(_data: unknown | undefined): void {
    this.cooldowns.forEach((_, id) => this.cooldowns.set(id, 0));
    this.clearProjectiles();
    this.markOptionsDirty();
    this.pushSpellOptions();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0) {
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
    } else if (this.projectiles.length > 0) {
      this.updateProjectiles(delta);
    }

    if (cooldownChanged) {
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

    this.spawnProjectile(spellId, config, origin, direction);
    this.cooldowns.set(spellId, Math.max(0, config.cooldownSeconds * 1000));
    this.markOptionsDirty();
    return true;
  }

  private spawnProjectile(
    spellId: SpellId,
    config: SpellConfig,
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

    this.projectiles.push({
      id: objectId,
      spellId,
      position: { ...position },
      velocity,
      radius: config.projectile.radius,
      elapsedMs: 0,
      lifetimeMs: Math.max(0, config.projectile.lifetimeMs),
      direction: { ...direction },
      damage: config.damage,
    });
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
          const damage = randomDamage(projectile.damage);
          this.bricks.applyDamage(collided.id, damage, projectile.direction);
          this.scene.removeObject(projectile.id);
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

      survivors.push(projectile);
    });

    this.projectiles = survivors;
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

  private markOptionsDirty(): void {
    this.optionsDirty = true;
  }

  private pushSpellOptions(): void {
    const payload: SpellOption[] = SPELL_IDS.map((id) => {
      const config = this.configs.get(id)!;
      return {
        id,
        name: config.name,
        cost: cloneCost(config.cost),
        cooldownSeconds: config.cooldownSeconds,
        remainingCooldownMs: Math.max(0, this.cooldowns.get(id) ?? 0),
      };
    });
    this.bridge.setValue(SPELL_OPTIONS_BRIDGE_KEY, payload);
    this.optionsDirty = false;
  }
}
