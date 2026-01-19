export type MapEffectId = "radioactivity";

export type MapEffectTarget = "playerUnits" | "enemies";

import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";

export interface MapEffectVisualConfig {
  readonly tintColor: SceneColor;
  readonly maxTintAlpha: number;
  readonly maxNoiseAlpha: number;
  readonly maxNoiseColor: number;
  readonly noiseScale: number;
  readonly noiseDensity?: number;
}

export interface MapEffectConfig {
  readonly id: MapEffectId;
  readonly name: string;
  readonly maxLevel: number;
  readonly growthPerSecond: number;
  readonly hpDrainPercentPerSecond: number;
  readonly targets: readonly MapEffectTarget[];
  readonly visuals?: MapEffectVisualConfig;
}

const MAP_EFFECTS_DB: Record<MapEffectId, MapEffectConfig> = {
  radioactivity: {
    id: "radioactivity",
    name: "Radioactivity",
    maxLevel: 1,
    growthPerSecond: 0.01,
    hpDrainPercentPerSecond: 0.5,
    targets: ["playerUnits"],
    visuals: {
      tintColor: { r: 0.1, g: 0.9, b: 0.45, a: 1 },
      maxTintAlpha: 0.12,
      maxNoiseAlpha: 0.2,
      maxNoiseColor: 0.25,
      noiseScale: 1.4,
      noiseDensity: 0.8,
    },
  },
};

export const getMapEffectConfig = (id: MapEffectId): MapEffectConfig => MAP_EFFECTS_DB[id];
