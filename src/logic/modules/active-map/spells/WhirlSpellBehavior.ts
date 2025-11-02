import { SceneObjectManager, SceneVector2 } from "../../../services/SceneObjectManager";
import { BricksModule } from "../BricksModule";
import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "./SpellBehavior";
import { BonusValueMap } from "../../shared/BonusesModule";
import type { BrickRuntimeState } from "../BricksModule";

const OUT_OF_BOUNDS_MARGIN = 50;

interface WhirlState {
  id: string;
  spellId: string;
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

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);

export class WhirlSpellBehavior implements SpellBehavior {
  public readonly spellType = "whirl" as const;

  private readonly scene: SceneObjectManager;
  private readonly bricks: BricksModule;
  private readonly getSpellPowerMultiplier: () => number;

  private storms: WhirlState[] = [];
  private spellPowerMultiplier = 1;

  constructor(dependencies: SpellBehaviorDependencies) {
    this.scene = dependencies.scene;
    this.bricks = dependencies.bricks;
    this.getSpellPowerMultiplier = dependencies.getSpellPowerMultiplier;
    this.spellPowerMultiplier = dependencies.getSpellPowerMultiplier();
  }

  public canCast(context: SpellCanCastContext): boolean {
    return (
      context.isUnlocked &&
      context.isMapActive &&
      context.cooldownRemainingMs <= 0
    );
  }

  public cast(context: SpellCastContext): boolean {
    if (context.config.type !== "whirl") {
      return false;
    }

    const whirl = context.config.whirl;
    const radius = Math.max(1, whirl.radius);
    const speed = Math.max(0, whirl.speed);
    const velocity: SceneVector2 = {
      x: context.direction.x * speed,
      y: context.direction.y * speed,
    };
    const position = { ...context.origin };
    const damageMultiplier = context.spellPowerMultiplier;
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

    const state: WhirlState = {
      id: objectId,
      spellId: context.spellId,
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
    return true;
  }

  public tick(deltaMs: number): void {
    if (deltaMs <= 0 || this.storms.length === 0) {
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const mapSize = this.scene.getMapSize();
    const survivors: WhirlState[] = [];

    this.storms.forEach((storm) => {
      storm.position = {
        x: storm.position.x + storm.velocity.x * deltaSeconds,
        y: storm.position.y + storm.velocity.y * deltaSeconds,
      };
      storm.phase += storm.spinSpeed * deltaSeconds;

      if (this.isOutOfBounds(storm.position, storm.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        this.scene.removeObject(storm.id);
        return;
      }

      const damage = Math.max(
        0,
        storm.baseDamagePerSecond * storm.damageMultiplier * deltaSeconds,
      );
      let inflictedTotal = 0;
      if (damage > 0) {
        this.bricks.forEachBrickNear(storm.position, storm.radius, (brick: BrickRuntimeState) => {
          const beforeHp = Math.max(brick.hp, 0);
          if (beforeHp <= 0) {
            return;
          }
          const direction = this.normalizeDirection({
            x: brick.position.x - storm.position.x,
            y: brick.position.y - storm.position.y,
          });
          const result = this.bricks.applyDamage(
            brick.id,
            damage,
            direction ?? { x: 0, y: 0 },
            { overTime: deltaSeconds }
          );
          const afterHp = result.brick ? Math.max(result.brick.hp, 0) : 0;
          const inflicted = Math.min(beforeHp, Math.max(beforeHp - afterHp, 0));
          if (inflicted > 0) {
            inflictedTotal += inflicted;
          }
        });
      }

      if (inflictedTotal > 0) {
        storm.remainingHealth = Math.max(0, storm.remainingHealth - inflictedTotal);
      }

      if (storm.remainingHealth <= 0) {
        this.scene.removeObject(storm.id);
        return;
      }

      if (this.isOutOfBounds(storm.position, storm.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
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

  public clear(): void {
    this.storms.forEach((storm) => {
      this.scene.removeObject(storm.id);
    });
    this.storms = [];
  }

  public onBonusValuesChanged(values: BonusValueMap): void {
    const raw = values["spell_power"];
    const sanitized = Number.isFinite(raw) ? Math.max(raw, 0) : 1;
    if (Math.abs(sanitized - this.spellPowerMultiplier) < 1e-6) {
      return;
    }
    this.spellPowerMultiplier = sanitized;
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
  }

  public serializeState(): unknown {
    return null;
  }

  public deserializeState(_data: unknown): void {
    // Not implemented
  }

  private isOutOfBounds(
    position: SceneVector2,
    radius: number,
    mapSize: { width: number; height: number },
    margin: number = 0,
  ): boolean {
    return (
      position.x + radius < -margin ||
      position.y + radius < -margin ||
      position.x - radius > mapSize.width + margin ||
      position.y - radius > mapSize.height + margin
    );
  }

  private normalizeDirection(vector: SceneVector2): SceneVector2 | null {
    const length = Math.hypot(vector.x, vector.y);
    if (!Number.isFinite(length) || length <= 0) {
      return null;
    }
    return { x: vector.x / length, y: vector.y / length };
  }
}

