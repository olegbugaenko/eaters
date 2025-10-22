import { GameModule } from "../core/types";
import { SceneObjectManager } from "../services/SceneObjectManager";
import { getVisualEffectRenderer, VisualEffectId } from "../../db/effects-db";

interface EffectsModuleOptions {
  scene: SceneObjectManager;
  getUnitPositionIfAlive: (unitId: string) => { x: number; y: number } | null;
}

interface AuraState {
  objectId: string; // scene object id for aura
  effectId: VisualEffectId;
  unitId: string;
}

export class EffectsModule implements GameModule {
  public readonly id = "effects";

  private readonly scene: SceneObjectManager;
  private readonly getUnitPositionIfAlive: (unitId: string) => { x: number; y: number } | null;
  // unitId -> (effectId -> aura state)
  private auraByUnit = new Map<string, Map<VisualEffectId, AuraState>>();

  constructor(options: EffectsModuleOptions) {
    this.scene = options.scene;
    this.getUnitPositionIfAlive = options.getUnitPositionIfAlive;
  }

  public initialize(): void {}

  public reset(): void {
    this.clearAll();
  }

  public load(_data: unknown | undefined): void {
    this.clearAll();
  }

  public save(): unknown {
    return null;
  }

  public tick(_deltaMs: number): void {
    // Keep aura positions synced with their units
    this.auraByUnit.forEach((effectsMap, unitId) => {
      const pos = this.getUnitPositionIfAlive(unitId);
      if (!pos) {
        // unit gone; cleanup all its auras
        effectsMap.forEach((a) => this.scene.removeObject(a.objectId));
        this.auraByUnit.delete(unitId);
        return;
      }
      effectsMap.forEach((a) => {
        const inst = this.scene.getObject(a.objectId);
        if (inst) {
          this.scene.updateObject(a.objectId, { position: { x: pos.x, y: pos.y } });
        }
      });
    });
  }

  public applyEffect(unitId: string, effectId: VisualEffectId): void {
    // If already applied, no-op
    let effectsMap = this.auraByUnit.get(unitId);
    if (effectsMap && effectsMap.has(effectId)) {
      return;
    }
    const renderer = getVisualEffectRenderer(effectId);
    if (!renderer) return;
    const pos = this.getUnitPositionIfAlive(unitId);
    if (!pos) return;
    const id = this.scene.addObject("aura", {
      position: { x: pos.x, y: pos.y },
      fill: { fillType: 0 as any, color: { r: 1, g: 1, b: 1, a: 0 } as any },
      customData: { renderer },
    });
    if (!effectsMap) {
      effectsMap = new Map<VisualEffectId, AuraState>();
      this.auraByUnit.set(unitId, effectsMap);
    }
    effectsMap.set(effectId, { objectId: id, effectId, unitId });
  }

  public removeEffect(unitId: string, effectId: VisualEffectId): void {
    const effectsMap = this.auraByUnit.get(unitId);
    if (!effectsMap) return;
    const a = effectsMap.get(effectId);
    if (a) {
      this.scene.removeObject(a.objectId);
      effectsMap.delete(effectId);
    }
    if (effectsMap.size === 0) this.auraByUnit.delete(unitId);
  }

  private clearAll(): void {
    this.auraByUnit.forEach((effectsMap) => {
      effectsMap.forEach((a) => this.scene.removeObject(a.objectId));
    });
    this.auraByUnit.clear();
  }
}


