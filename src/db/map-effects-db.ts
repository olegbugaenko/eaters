export type MapEffectId = "radioactivity";

export type MapEffectTarget = "playerUnits" | "enemies";

export interface MapEffectConfig {
  readonly id: MapEffectId;
  readonly name: string;
  readonly maxLevel: number;
  readonly growthPerSecond: number;
  readonly hpDrainPercentPerSecond: number;
  readonly targets: readonly MapEffectTarget[];
}

const MAP_EFFECTS_DB: Record<MapEffectId, MapEffectConfig> = {
  radioactivity: {
    id: "radioactivity",
    name: "Radioactivity",
    maxLevel: 1,
    growthPerSecond: 0.01,
    hpDrainPercentPerSecond: 0.5,
    targets: ["playerUnits"],
  },
};

export const getMapEffectConfig = (id: MapEffectId): MapEffectConfig => MAP_EFFECTS_DB[id];
