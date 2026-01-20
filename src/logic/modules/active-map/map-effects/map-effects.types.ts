import type {
  MapEffectId,
  MapEffectPostProcessConfig,
  MapEffectTarget,
} from "../../../../db/map-effects-db";

export interface MapEffectRuntimeState {
  id: MapEffectId;
  level: number;
  maxLevel: number;
  growthPerSecond: number;
  hpDrainPercentPerSecond: number;
  targets: readonly MapEffectTarget[];
  postProcess?: MapEffectPostProcessConfig;
}
