import { GameModule } from "@core/logic/types";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { ArcType, getArcConfig } from "../../../../db/arcs-db";
import { getNowMs } from "@shared/helpers/time.helper";
import { addVectors, sanitizeOffset } from "@shared/helpers/vector.helper";
import type { ArcModuleOptions, ArcSpawnOptions, ArcState, ArcTargetRef } from "./arc.types";
import type { SoundEffectPlayer } from "../../../../core/logic/provided/modules/audio/audio.types";

export class ArcModule implements GameModule {
  public readonly id = "arcs";

  private readonly scene: SceneObjectManager;
  private readonly getUnitPositionIfAlive: (
    unitId: string,
  ) => SceneVector2 | null;
  private readonly getEnemyPositionIfAlive?: (
    enemyId: string,
  ) => SceneVector2 | null;
  private readonly audio?: SoundEffectPlayer;
  private arcs: ArcState[] = [];

  constructor(options: ArcModuleOptions) {
    this.scene = options.scene;
    this.getUnitPositionIfAlive = options.getUnitPositionIfAlive;
    this.getEnemyPositionIfAlive = options.getEnemyPositionIfAlive;
    this.audio = options.audio;
  }

  public initialize(): void {}

  public reset(): void {
    this.clearArcs();
  }

  public load(_data: unknown | undefined): void {
    this.clearArcs();
  }

  public save(): unknown {
    return null;
  }

  public tick(deltaMs: number): void {
    if (this.arcs.length === 0) return;
    const survivors: ArcState[] = [];
    const dec = Math.max(0, deltaMs);
    const now = getNowMs();
    const realNow = Date.now();
    for (let i = 0; i < this.arcs.length; i += 1) {
      const a = this.arcs[i]!;
      let from = this.getArcTargetPosition(a.source, a.sourceOffset);
      let to = this.getArcTargetPosition(a.target);
      
      // If target died, use last known position if persistOnDeath is enabled
      if (a.persistOnDeath) {
        if (!from && a.lastFrom) from = a.lastFrom;
        if (!to && a.lastTo) to = a.lastTo;
      }
      
      if (!from || !to) {
        // Don't remove arc on the same tick it was created - 
        // this causes a race condition where customData is cleared
        // before the renderer has a chance to process it
        const timeSinceCreation = now - a.createdAtMs;
        if (timeSinceCreation < 16) {
          // Skip this tick, let the arc live at least one render frame
          survivors.push(a);
          continue;
        }
        this.scene.removeObject(a.id);
        continue;
      }
      // update endpoints and nudge renderer to advance time
      this.scene.updateObject(a.id, {
        position: { ...from },
        fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
        customData: {
          arcType: a.type,
          from: { ...from },
          to: { ...to },
          createdAtMs: a.createdAtMs,
          lifetimeMs: a.lifetimeMs,
          fadeStartMs: a.fadeStartMs,
        },
      });
      const elapsed = Math.max(
        dec,
        now - a.lastUpdateTimestampMs,
        realNow - a.lastRealTimestampMs,
      );
      const next = a.remainingMs - elapsed;
      if (next <= 0) {
        this.scene.removeObject(a.id);
      } else {
        survivors.push({
          ...a,
          remainingMs: next,
          lastUpdateTimestampMs: now,
          lastRealTimestampMs: realNow,
          lastFrom: from,
          lastTo: to,
        });
      }
    }
    this.arcs = survivors;
  }

  public spawnArcBetweenUnits(
    type: ArcType,
    sourceUnitId: string,
    targetUnitId: string,
    options?: ArcSpawnOptions,
  ): void {
    this.spawnArcBetweenTargets(
      type,
      { type: "unit", id: sourceUnitId },
      { type: "unit", id: targetUnitId },
      options,
    );
  }

  public spawnArcBetweenTargets(
    type: ArcType,
    source: ArcTargetRef,
    target: ArcTargetRef,
    options?: ArcSpawnOptions,
  ): void {
    const cfg = getArcConfig(type);
    
    const sourceOffset = sanitizeOffset(options?.sourceOffset);
    const from = this.getArcTargetPosition(source, sourceOffset);
    const to = this.getArcTargetPosition(target);
    if (!from || !to) {
      return;
    }
    const now = getNowMs();
    const realNow = Date.now();
    const id = this.scene.addObject("arc", {
      position: { ...from },
      fill: { fillType: FILL_TYPES.SOLID, color: { r: 1, g: 1, b: 1, a: 0 } },
      customData: {
        arcType: type,
        from: { ...from },
        to: { ...to },
        lifetimeMs: cfg.lifetimeMs,
        fadeStartMs: cfg.fadeStartMs,
        createdAtMs: now,
      },
    });
    this.arcs.push({
      id,
      type,
      source,
      target,
      sourceOffset,
      remainingMs: cfg.lifetimeMs,
      lifetimeMs: cfg.lifetimeMs,
      fadeStartMs: cfg.fadeStartMs,
      createdAtMs: now,
      lastUpdateTimestampMs: now,
      lastRealTimestampMs: realNow,
      persistOnDeath: options?.persistOnDeath,
      lastFrom: from,
      lastTo: to,
    });
    if (cfg.soundEffectUrl) {
      this.audio?.playSoundEffect(cfg.soundEffectUrl);
    }
  }

  public clearArcsForUnit(unitId: string): void {
    if (!unitId || this.arcs.length === 0) {
      return;
    }
    const now = getNowMs();
    const survivors: ArcState[] = [];
    for (let i = 0; i < this.arcs.length; i += 1) {
      const arc = this.arcs[i]!;
      if (
        (arc.source.type === "unit" && arc.source.id === unitId) ||
        (arc.target.type === "unit" && arc.target.id === unitId)
      ) {
        // If persistOnDeath is enabled, keep the arc alive
        if (arc.persistOnDeath) {
          survivors.push(arc);
          continue;
        }
        // Don't remove arc on the same tick it was created - 
        // this causes a race condition where customData is cleared
        // before the renderer has a chance to process it
        const timeSinceCreation = now - arc.createdAtMs;
        if (timeSinceCreation < 16) {
          survivors.push(arc);
          continue;
        }
        this.scene.removeObject(arc.id);
        continue;
      }
      survivors.push(arc);
    }
    if (survivors.length !== this.arcs.length) {
      this.arcs = survivors;
    }
  }

  public clearArcs(): void {
    this.arcs.forEach((a) => this.scene.removeObject(a.id));
    this.arcs = [];
  }

  private getArcTargetPosition(
    target: ArcTargetRef,
    offset?: SceneVector2,
  ): SceneVector2 | null {
    if (target.type === "unit") {
      const position = this.getUnitPositionIfAlive(target.id);
      if (!position) {
        return null;
      }
      return offset ? addVectors(position, offset) : position;
    }
    if (target.type === "enemy") {
      const position = this.getEnemyPositionIfAlive?.(target.id) ?? null;
      if (!position) {
        return null;
      }
      return offset ? addVectors(position, offset) : position;
    }
    return null;
  }
}
