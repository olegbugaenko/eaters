import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { VisualEffectId } from "../../../../db/effects-db";

export interface EffectsModuleOptions {
  scene: SceneObjectManager;
  getUnitPositionIfAlive: (unitId: string) => { x: number; y: number } | null;
}

export interface AuraState {
  objectId: string; // scene object id for aura
  effectId: VisualEffectId;
  unitId: string;
}
