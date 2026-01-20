import type { SceneGradientStop } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { ExplosionWaveConfig } from "./explosions.types";

export const createSimpleWave = (options: {
  defaultInitialRadius: number;
  radiusExtension: number;
  startAlpha: number;
  endAlpha: number;
  gradientStops: readonly SceneGradientStop[];
}): ExplosionWaveConfig[] => [
  {
    initialInnerRadius: 0,
    expansionInnerRadius: 0,
    initialOuterRadius: options.defaultInitialRadius,
    expansionOuterRadius:
      options.defaultInitialRadius + Math.max(0, options.radiusExtension),
    startAlpha: options.startAlpha,
    endAlpha: options.endAlpha,
    gradientStops: options.gradientStops,
  },
];
