import type {
  SceneColor,
  SceneFill,
  SceneSolidFill,
} from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.const";
import type { RendererFillConfig, RendererStrokeConfig } from "@shared/types/renderer-config";
import type { BaseRendererLayerConfig, BaseRendererLayerFields, RendererCompositeConfig } from "@shared/types/renderer.types";

export type VisualEffectId = "frenzyAura";

export type VisualEffectOverlayTarget = "fill" | "stroke";

export interface VisualEffectOverlayConfig {
  readonly color: SceneColor;
  readonly intensity: number; // 0..1
  readonly blendMode?: "tint" | "add";
  readonly priority?: number;
  readonly target?: VisualEffectOverlayTarget | readonly VisualEffectOverlayTarget[];
}

export type AuraRendererLayer = BaseRendererLayerConfig<BaseRendererLayerFields>;

export type AuraRendererCompositeConfig = RendererCompositeConfig<AuraRendererLayer>;

export interface VisualEffectConfig extends VisualEffectOverlayConfig {
  readonly renderer?: AuraRendererCompositeConfig;
}

const EFFECTS_DB: Record<VisualEffectId, VisualEffectConfig> = {
  frenzyAura: {
    color: { r: 1.0, g: 0.55, b: 0.2, a: 1 },
    intensity: 0.55,
    blendMode: "add",
    priority: 60,
    target: "fill",
    renderer: {
      kind: "composite",
      layers: [
        {
          shape: "circle",
          radius: 38,
          segments: 48,
          offset: { x: 0, y: 0 },
          fill: {
            type: "gradient",
            fill: {
              fillType: FILL_TYPES.RADIAL_GRADIENT,
              start: { x: 0, y: 0 },
              end: 24,
              stops: [
                { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.6, color: { r: 0.9, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.75, color: { r: 1.0, g: 0.7, b: 0.5, a: 0.45 } },
                { offset: 1, color: { r: 1.0, g: 0.9, b: 0.5, a: 0.0 } },
              ],
            },
          },
        },
      ],
    },
  },
};

export const getVisualEffectOverlay = (
  id: VisualEffectId
): VisualEffectOverlayConfig => {
  const cfg = EFFECTS_DB[id];
  if (!cfg) {
    throw new Error(`Unknown visual effect id: ${id}`);
  }
  return cfg;
};

export const getVisualEffectRenderer = (
  id: VisualEffectId
): AuraRendererCompositeConfig | undefined => {
  const cfg = EFFECTS_DB[id];
  return cfg?.renderer;
};


