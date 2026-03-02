import type { MapId } from "./maps/maps-db";

export const ARTIFACT_IDS = ["great_octopus_tentacle"] as const;

export type ArtifactId = (typeof ARTIFACT_IDS)[number];

export interface ArtifactConfig {
  readonly id: ArtifactId;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly unlockedByMap?: { id: MapId; level: number };
  readonly effects: {
    readonly sanityDecayMultiplier?: number;
    readonly maxUnitsFlat?: number;
  };
}

const ARTIFACTS_DB: Record<ArtifactId, ArtifactConfig> = {
  great_octopus_tentacle: {
    id: "great_octopus_tentacle",
    name: "Octopus Tentacle",
    description:
      "Doubles sanity decay, but grants +5 to the maximum number of monsters.",
    icon: "artifact_great_octopus_tentacle.png",
    unlockedByMap: { id: "greatOctopus", level: 1 },
    effects: {
      sanityDecayMultiplier: 2,
      maxUnitsFlat: 5,
    },
  },
};

export const getArtifactConfig = (id: ArtifactId): ArtifactConfig => {
  const config = ARTIFACTS_DB[id];
  if (!config) {
    throw new Error(`Unknown artifact id: ${id}`);
  }
  return config;
};

export const getAllArtifactConfigs = (): ArtifactConfig[] =>
  ARTIFACT_IDS.map((id) => ARTIFACTS_DB[id]);
