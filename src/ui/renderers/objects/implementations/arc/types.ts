import type {
  SceneObjectInstance,
  SceneVector2,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";
import type { ArcType } from "../../../../../db/arcs-db";

export interface ArcRendererCustomData {
  arcType: ArcType;
  from: SceneVector2;
  to: SceneVector2;
  lifetimeMs?: number;
  fadeStartMs?: number;
}
