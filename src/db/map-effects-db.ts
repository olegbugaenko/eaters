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

export interface MapEffectPostProcessConfig {
  readonly waveAmplitude: number;
  readonly waveFrequency: number;
  readonly waveSpeed: number;
  readonly jitterStrength: number;
  readonly jitterFrequency: number;
  readonly bandSpeed: number;
  readonly bandWidth: number;
  readonly bandIntensity: number;
}

export interface MapEffectConfig {
  readonly id: MapEffectId;
  readonly name: string;
  readonly maxLevel: number;
  readonly growthPerSecond: number;
  readonly hpDrainPercentPerSecond: number;
  readonly targets: readonly MapEffectTarget[];
  readonly visuals?: MapEffectVisualConfig;
  readonly postProcess?: MapEffectPostProcessConfig;
}

const MAP_EFFECTS_DB: Record<MapEffectId, MapEffectConfig> = {
  radioactivity: {
    id: "radioactivity",
    name: "Radioactivity",
    maxLevel: 1,
    growthPerSecond: 0.01,
    hpDrainPercentPerSecond: 25,
    targets: ["playerUnits"],
    visuals: {
      tintColor: { r: 0.1, g: 0.9, b: 0.45, a: 1 },
      maxTintAlpha: 0.12,
      maxNoiseAlpha: 0.02,
      maxNoiseColor: 0.02,
      noiseScale: 1.4,
      noiseDensity: 0.8,
    },
    postProcess: {
      waveAmplitude: 14,
      waveFrequency: 10,
      waveSpeed: 1.4,
      jitterStrength: 4,
      jitterFrequency: 140,
      bandSpeed: 0.12,
      bandWidth: 0.16,
      bandIntensity: 0.2,
    },
  },
};

export const getMapEffectConfig = (id: MapEffectId): MapEffectConfig => MAP_EFFECTS_DB[id];
