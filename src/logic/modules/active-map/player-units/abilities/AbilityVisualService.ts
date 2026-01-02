import {
  FILL_TYPES,
  SceneObjectManager,
  SceneVector2,
} from "../../../../services/SceneObjectManager";
import type { ArcModule } from "../../../scene/arc/arc.module";
import type { ExplosionModule } from "../../../scene/explosion/explosion.module";
import type { EffectsModule } from "../../../scene/effects/effects.module";
import type { FireballModule } from "../../../scene/fireball/fireball.module";
import type { ExplosionType } from "../../../../../db/explosions-db";
import { getArcConfig } from "../../../../../db/arcs-db";
import type { PlayerUnitAbilityState } from "./AbilityUnitState";

interface AbilityVisualServiceOptions {
  scene: SceneObjectManager;
  explosions: ExplosionModule;
  getArcs: () => ArcModule | undefined;
  getEffects: () => EffectsModule | undefined;
  getFireballs: () => FireballModule | undefined;
}

interface AbilityArcEntry {
  id: string;
  remainingMs: number;
  sourceUnitId: string;
  targetUnitId: string;
  arcType: "heal" | "frenzy";
}

interface FireballLaunchOptions {
  sourceUnitId: string;
  sourcePosition: SceneVector2;
  targetBrickId: string;
  damage: number;
  explosionRadius: number;
  maxDistance: number;
}

export class AbilityVisualService {
  private readonly scene: SceneObjectManager;
  private readonly explosions: ExplosionModule;
  private readonly getArcs: () => ArcModule | undefined;
  private readonly getEffects: () => EffectsModule | undefined;
  private readonly getFireballs: () => FireballModule | undefined;
  private activeArcEffects: AbilityArcEntry[] = [];

  constructor(options: AbilityVisualServiceOptions) {
    this.scene = options.scene;
    this.explosions = options.explosions;
    this.getArcs = options.getArcs;
    this.getEffects = options.getEffects;
    this.getFireballs = options.getFireballs;
  }

  public reset(): void {
    if (this.activeArcEffects.length === 0) {
      return;
    }
    this.activeArcEffects.forEach((entry) => {
      this.scene.removeObject(entry.id);
    });
    this.activeArcEffects = [];
  }

  public update(
    deltaMs: number,
    getUnitById: (id: string) => PlayerUnitAbilityState | undefined,
  ): void {
    if (deltaMs <= 0 || this.activeArcEffects.length === 0) {
      return;
    }
    const survivors: AbilityArcEntry[] = [];
    const decrement = Math.max(0, deltaMs);
    for (let i = 0; i < this.activeArcEffects.length; i += 1) {
      const entry = this.activeArcEffects[i]!;
      const next = entry.remainingMs - decrement;
      const source = getUnitById(entry.sourceUnitId);
      const target = getUnitById(entry.targetUnitId);
      if (!source || !target || source.hp <= 0 || target.hp <= 0) {
        this.scene.removeObject(entry.id);
        continue;
      }
      this.scene.updateObject(entry.id, {
        position: { ...source.position },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType: entry.arcType,
          from: { ...source.position },
          to: { ...target.position },
        },
      });
      if (next <= 0) {
        this.scene.removeObject(entry.id);
      } else {
        survivors.push({ ...entry, remainingMs: next });
      }
    }
    this.activeArcEffects = survivors;
  }

  public spawnExplosionByType(
    type: ExplosionType,
    options: { position: SceneVector2; initialRadius?: number },
  ): void {
    this.explosions.spawnExplosionByType(type, options);
  }

  public applyEffect(unitId: string, effectId: string): void {
    this.getEffects()?.applyEffect(unitId, effectId as never);
  }

  public removeEffect(unitId: string, effectId: string): void {
    this.getEffects()?.removeEffect(unitId, effectId as never);
  }

  public hasEffect(unitId: string, effectId: string): boolean {
    return this.getEffects()?.hasEffect(unitId, effectId as never) ?? false;
  }

  public spawnArcBetweenUnits(
    arcType: "heal" | "frenzy",
    source: PlayerUnitAbilityState,
    target: PlayerUnitAbilityState,
  ): void {
    const arcModule = this.getArcs();
    if (arcModule) {
      try {
        arcModule.spawnArcBetweenUnits(arcType, source.id, target.id);
        return;
      } catch {
        // fall through to manual arc if ArcModule fails
      }
    }

    try {
      const config = getArcConfig(arcType);
      const arcId = this.scene.addObject("arc", {
        position: { ...source.position },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType,
          from: { ...source.position },
          to: { ...target.position },
          lifetimeMs: config.lifetimeMs,
          fadeStartMs: config.fadeStartMs,
        },
      });
      this.activeArcEffects.push({
        id: arcId,
        remainingMs: config.lifetimeMs,
        sourceUnitId: source.id,
        targetUnitId: target.id,
        arcType,
      });
    } catch {
      // ignore arc failures; abilities still apply
    }
  }

  public launchFireball(options: FireballLaunchOptions): boolean {
    const module = this.getFireballs();
    if (!module) {
      return false;
    }
    module.spawnFireball({
      sourceUnitId: options.sourceUnitId,
      sourcePosition: options.sourcePosition,
      targetBrickId: options.targetBrickId,
      damage: options.damage,
      explosionRadius: options.explosionRadius,
      maxDistance: options.maxDistance,
    });
    return true;
  }
}
