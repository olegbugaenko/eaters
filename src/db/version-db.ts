export interface GameVersionInfo {
  displayName: string;
  releaseDate: string;
  changes: string[];
}

export const GAME_VERSIONS: GameVersionInfo[] = [
  {
    displayName: "v0.1.0",
    releaseDate: "2026-01-11",
    changes: [
      "Added new maps",
      "Added new type of targets and enemies",
      "Added brick damage visualisation",
      "Few bugfixes and performance improvements",
    ],
  },
  {
    displayName: "v0.0.5c",
    releaseDate: "2026-01-05",
    changes: [
      "Fixed camera zoom initialization and minimum zoom calculation",
      "Added mouse wheel zoom support on map",
      "Fixed viewport position jumping on map tree and skill tree initialization",
      "Added viewport position saving for map tree and skill tree",
      "Fixed brick animation smoothness with position interpolation",
      "Fixed particle animation issues - unit tail particles now animate smoothly",
      "Fixed hover flickering on skill tree nodes when cursor is on the edge",
    ],
  },
  {
    displayName: "v0.0.5b",
    releaseDate: "2026-01-01",
    changes: [
      "Added interpolation for projectiles for smoother movement",
      "Fixed unit animation rendering issues"
    ],
  },
  {
    displayName: "v0.0.5a",
    releaseDate: "2025-12-30",
    changes: [
      "Improved visuals for projectiles",
      "Performance improvements"
    ],
  },
  {
    displayName: "v0.0.5",
    releaseDate: "2025-12-28",
    changes: [
      "Significantly reworked UI for maps and skills",
      "Added new maps",
      "Added new unit organs",
      "Performance improvements"
    ],
  },
  {
    displayName: "v0.0.4b",
    releaseDate: "2025-12-23",
    changes: [
      "Fixed bug where game run might continue after sanity is depleted",
      "Fixed some performance issues"
    ],
  },
  {
    displayName: "v0.0.4a",
    releaseDate: "2025-12-19",
    changes: [
      "Simplified tutorial",
      "Fixed some UI issues",
      "Fixed some skills descriptions"
    ],
  },
  {
    displayName: "v0.0.4",
    releaseDate: "2025-12-19",
    changes: [
      "Re-worked how sanity works",
      "Added new skills",
      "Significant rebalances"
    ],
  },
  {
    displayName: "v0.0.3c",
    releaseDate: "2025-11-11",
    changes: [
      "Fixed memory leaks",
      "Improved some unit parts display",
      "Fixed particle behaviour on MacOS"
    ],
  },
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
