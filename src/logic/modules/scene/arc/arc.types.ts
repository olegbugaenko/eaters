import type { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ArcType } from "../../../../db/arcs-db";

export type ArcTargetType = "unit" | "enemy";

export interface ArcTargetRef {
  readonly type: ArcTargetType;
  readonly id: string;
}

export interface ArcModuleOptions {
  scene: SceneObjectManager;
  getUnitPositionIfAlive: (unitId: string) => SceneVector2 | null;
  getEnemyPositionIfAlive?: (enemyId: string) => SceneVector2 | null;
}

export interface ArcSpawnOptions {
  readonly sourceOffset?: SceneVector2;
}

export interface ArcState {
  id: string; // scene object id
  type: ArcType;
  source: ArcTargetRef;
  target: ArcTargetRef;
  sourceOffset?: SceneVector2;
  remainingMs: number;
  lifetimeMs: number;
  fadeStartMs: number;
  lastUpdateTimestampMs: number;
  lastRealTimestampMs: number;
}
