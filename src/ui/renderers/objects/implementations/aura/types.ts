import type {
  AuraRendererCompositeConfig,
  AuraRendererLayer,
  AuraRendererFillConfig,
  AuraRendererStrokeConfig,
} from "../../../../../db/effects-db";
import type { SceneObjectInstance } from "@/logic/services/scene-object-manager/scene-object-manager.types";

export interface AuraCustomData {
  renderer: AuraRendererCompositeConfig;
}

export type RendererLayer = AuraRendererLayer;

export type { AuraRendererFillConfig, AuraRendererStrokeConfig };
