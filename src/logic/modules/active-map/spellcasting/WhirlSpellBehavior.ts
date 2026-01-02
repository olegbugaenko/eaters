import { SceneObjectManager, SceneVector2, SceneColor } from "../../../services/SceneObjectManager";
import { BricksModule } from "../bricks/bricks.module";
import {
  SpellBehavior,
  SpellCastContext,
  SpellCanCastContext,
  SpellBehaviorDependencies,
} from "./SpellBehavior";
import { BonusValueMap } from "../../shared/bonuses/bonuses.module";
import type { BrickRuntimeState } from "../bricks/bricks.module";
import { clampNumber } from "@/utils/helpers/numbers";

const OUT_OF_BOUNDS_MARGIN = 50;

interface SandStormCustomData {
  intensity: number;
  phase: number;
  velocity: SceneVector2;
  lastUpdateTime: number;
  spinSpeed: number;
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: SceneColor;
  colorMid: SceneColor;
  colorOuter: SceneColor;
}

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
  // Візуальні параметри
  rotationSpeedMultiplier: number;
  spiralArms: number;
  spiralArms2: number;
  spiralTwist: number;
  spiralTwist2: number;
  colorInner: SceneColor;
  colorMid: SceneColor;
  colorOuter: SceneColor;
  renderData: SandStormCustomData;
}

const getNowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

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

    const spinSpeed = Math.max(0, whirl.spinSpeed ?? 2.5);
    const rotationSpeedMultiplier = whirl.rotationSpeedMultiplier ?? 1.0;
    const spiralArms = whirl.spiralArms ?? 6.0;
    const spiralArms2 = whirl.spiralArms2 ?? 12.0;
    const spiralTwist = whirl.spiralTwist ?? 7.0;
    const spiralTwist2 = whirl.spiralTwist2 ?? 4.0;
    const colorInner = whirl.colorInner
      ? { ...whirl.colorInner }
      : { r: 0.95, g: 0.88, b: 0.72, a: 1 };
    const colorMid = whirl.colorMid
      ? { ...whirl.colorMid }
      : { r: 0.85, g: 0.72, b: 0.58, a: 1 };
    const colorOuter = whirl.colorOuter
      ? { ...whirl.colorOuter }
      : { r: 0.68, g: 0.55, b: 0.43, a: 1 };

    const renderData: SandStormCustomData = {
      intensity: maxHealth > 0 ? 1 : 0,
      phase: 0,
      velocity: { x: velocity.x, y: velocity.y },
      lastUpdateTime: getNowMs(),
      spinSpeed,
      rotationSpeedMultiplier,
      spiralArms,
      spiralArms2,
      spiralTwist,
      spiralTwist2,
      colorInner,
      colorMid,
      colorOuter,
    };

    const objectId = this.scene.addObject("sandStorm", {
      position: { ...position },
      size: { width: radius * 2, height: radius * 2 },
      customData: renderData,
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
      spinSpeed,
      rotationSpeedMultiplier,
      spiralArms,
      spiralArms2,
      spiralTwist,
      spiralTwist2,
      colorInner,
      colorMid,
      colorOuter,
      renderData,
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
      const renderData = storm.renderData;
      renderData.intensity = Math.max(0.25, intensity);
      renderData.phase = storm.phase;
      renderData.velocity.x = storm.velocity.x;
      renderData.velocity.y = storm.velocity.y;
      renderData.lastUpdateTime = getNowMs();
      renderData.spinSpeed = storm.spinSpeed;
      renderData.rotationSpeedMultiplier = storm.rotationSpeedMultiplier;
      renderData.spiralArms = storm.spiralArms;
      renderData.spiralArms2 = storm.spiralArms2;
      renderData.spiralTwist = storm.spiralTwist;
      renderData.spiralTwist2 = storm.spiralTwist2;

      this.scene.updateObject(storm.id, {
        position: { ...storm.position },
        size: { width: storm.radius * 2, height: storm.radius * 2 },
        customData: renderData,
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

  public cleanupExpired(): void {
    // Clean up storms that are out of bounds
    const mapSize = this.scene.getMapSize();
    let writeIndex = 0;
    for (let i = 0; i < this.storms.length; i += 1) {
      const storm = this.storms[i]!;
      if (this.isOutOfBounds(storm.position, storm.radius, mapSize, OUT_OF_BOUNDS_MARGIN)) {
        this.scene.removeObject(storm.id);
        continue;
      }
      // Also remove if health depleted (shouldn't happen, but safety check)
      if (storm.remainingHealth <= 0) {
        this.scene.removeObject(storm.id);
        continue;
      }
      this.storms[writeIndex++] = storm;
    }
    this.storms.length = writeIndex;
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
