import type { SceneObjectManager } from "../../../services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "../../../services/scene-object-manager/scene-object-manager.types";
import type { ArcType } from "../../../../db/arcs-db";

export interface ArcModuleOptions {
  scene: SceneObjectManager;
  getUnitPositionIfAlive: (unitId: string) => SceneVector2 | null;
}

export interface ArcState {
  id: string; // scene object id
  type: ArcType;
  sourceUnitId: string;
  targetUnitId: string;
  remainingMs: number;
  lifetimeMs: number;
  fadeStartMs: number;
  lastUpdateTimestampMs: number;
  lastRealTimestampMs: number;
}
