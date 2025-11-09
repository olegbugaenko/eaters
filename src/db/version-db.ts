export interface GameVersionInfo {
  displayName: string;
  releaseDate: string;
  changes: string[];
}

export const GAME_VERSIONS: GameVersionInfo[] = [
  {
    displayName: "v0.0.3b",
    releaseDate: "2025-11-09",
    changes: [
      "Significant UI and graphics improvements",
    ],
  },
  {
    displayName: "v0.0.3a",
    releaseDate: "2025-11-06",
    changes: [
      "Minor UI fixes",
      "Improved performance"
    ],
  },
  {
    displayName: "v0.0.3",
    releaseDate: "2025-11-02",
    changes: [
      "Implemented spells system",
      "Added music",
      "Minor performance fixes",
    ],
  },
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
