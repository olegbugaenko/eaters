import { GameModule } from "../../../core/types";
import { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import { FILL_TYPES } from "../../../services/scene-object-manager/scene-object-manager.const";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import { ArcType, getArcConfig } from "../../../../db/arcs-db";
import { getNowMs } from "@shared/helpers/time.helper";
import type { ArcModuleOptions, ArcState } from "./arc.types";

export class ArcModule implements GameModule {
  public readonly id = "arcs";

  private readonly scene: SceneObjectManager;
  private readonly getUnitPositionIfAlive: (unitId: string) => SceneVector2 | null;
  private arcs: ArcState[] = [];

  constructor(options: ArcModuleOptions) {
    this.scene = options.scene;
    this.getUnitPositionIfAlive = options.getUnitPositionIfAlive;
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
      const from = this.getUnitPositionIfAlive(a.sourceUnitId);
      const to = this.getUnitPositionIfAlive(a.targetUnitId);
      if (!from || !to) {
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
        },
      });
      const elapsed = Math.max(dec, now - a.lastUpdateTimestampMs, realNow - a.lastRealTimestampMs);
      const next = a.remainingMs - elapsed;
      if (next <= 0) {
        this.scene.removeObject(a.id);
      } else {
        survivors.push({
          ...a,
          remainingMs: next,
          lastUpdateTimestampMs: now,
          lastRealTimestampMs: realNow,
        });
      }
    }
    this.arcs = survivors;
  }

  public spawnArcBetweenUnits(type: ArcType, sourceUnitId: string, targetUnitId: string): void {
    const cfg = getArcConfig(type);
    const from = this.getUnitPositionIfAlive(sourceUnitId);
    const to = this.getUnitPositionIfAlive(targetUnitId);
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
      },
    });
    this.arcs.push({
      id,
      type,
      sourceUnitId,
      targetUnitId,
      remainingMs: cfg.lifetimeMs,
      lifetimeMs: cfg.lifetimeMs,
      fadeStartMs: cfg.fadeStartMs,
      lastUpdateTimestampMs: now,
      lastRealTimestampMs: realNow,
    });
  }

  public clearArcsForUnit(unitId: string): void {
    if (!unitId || this.arcs.length === 0) {
      return;
    }
    const survivors: ArcState[] = [];
    for (let i = 0; i < this.arcs.length; i += 1) {
      const arc = this.arcs[i]!;
      if (arc.sourceUnitId === unitId || arc.targetUnitId === unitId) {
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

}


