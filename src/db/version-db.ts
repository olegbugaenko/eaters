export interface GameVersionInfo {
  displayName: string;
  releaseDate: string;
  changes: string[];
}

export const GAME_VERSIONS: GameVersionInfo[] = [
  {
    displayName: "v0.0.2",
    releaseDate: "2025-10-24",
    changes: [
      "Implemented creatures behavour logic toggle",
      "Added new organs and active abilities",
      "Reduced some skills prices",
    ],
  },
];
