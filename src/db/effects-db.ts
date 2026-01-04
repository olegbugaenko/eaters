import type {
  SceneColor,
  SceneFill,
  SceneFillFilaments,
  SceneFillNoise,
} from "@/logic/services/scene-object-manager/scene-object-manager.types";

export type VisualEffectId = "frenzyAura";

export interface VisualEffectOverlayConfig {
  readonly color: SceneColor;
  readonly intensity: number; // 0..1
  readonly blendMode?: "tint" | "add";
  readonly priority?: number;
  readonly target?: "fill" | "stroke";
}

// Minimal renderer schema for auras (composite like player units)
export type AuraRendererFillConfig =
  | { type: "base"; brightness?: number; alphaMultiplier?: number }
  | { type: "solid"; color: SceneColor; noise?: SceneFillNoise; filaments?: SceneFillFilaments }
  | { type: "gradient"; fill: SceneFill };

export type AuraRendererStrokeConfig =
  | { type: "base"; width: number; brightness?: number; alphaMultiplier?: number }
  | { type: "solid"; width: number; color: SceneColor };

export type AuraRendererLayer =
  | {
      shape: "circle";
      radius: number;
      segments?: number;
      offset?: { x: number; y: number };
      fill?: AuraRendererFillConfig;
      stroke?: AuraRendererStrokeConfig;
    }
  | {
      shape: "polygon";
      vertices: readonly { x: number; y: number }[];
      offset?: { x: number; y: number };
      fill?: AuraRendererFillConfig;
      stroke?: AuraRendererStrokeConfig;
    };

export interface AuraRendererCompositeConfig {
  kind: "composite";
  layers: readonly AuraRendererLayer[];
}

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
              fillType: 2, // FILL_TYPES.RADIAL_GRADIENT resolved in renderer
              start: { x: 0, y: 0 },
              end: 24,
              stops: [
                { offset: 0, color: { r: 0.6, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.6, color: { r: 0.9, g: 0.85, b: 1, a: 0.0 } },
                { offset: 0.75, color: { r: 1.0, g: 0.7, b: 0.5, a: 0.45 } },
                { offset: 1, color: { r: 1.0, g: 0.9, b: 0.5, a: 0.0 } },
              ],
            } as any,
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


