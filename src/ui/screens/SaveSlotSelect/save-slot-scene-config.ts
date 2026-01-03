import { SceneSize } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { BrickType } from "@db/bricks-db";

export const MAP_SIZE: SceneSize = { width: 2400, height: 1650 };

export const LETTER_HORIZONTAL_GAP = 1;
export const LETTER_VERTICAL_GAP = 1;
export const LETTER_SPACING = 36;
export const WORD_SPACING = 0;
export const LINE_SPACING = 420;
export const TITLE_LINES = ["VOID", "EATERS"] as const;
export const DEFAULT_BRICK_TYPE: BrickType = "smallSquareGray";

// Real arch configuration - bricks placed along a semicircle with proper rotation
export const ARCH_GAP_FROM_TITLE = 320;
export const ARCH_OUTER_RADIUS = 320; // Outer radius of the arch curve
export const ARCH_INNER_RADIUS = 280; // Inner radius (creates thickness)
export const ARCH_PILLAR_HEIGHT = 880; // Height of the vertical pillars
export const ARCH_BRICK_GAP = 3; // Gap between bricks
export const ARCH_BOTTOM_PADDING = 60; // Distance from bottom of screen to pillar base

// Adjust brick types per letter to quickly experiment with the title palette.
export const LETTER_BRICK_TYPES: Partial<Record<string, BrickType>> = {
  V: "darkMatterBrick",
  O: "darkMatterBrick",
  I: "darkMatterBrick",
  D: "darkMatterBrick",
  E: "neutronBrick",
  A: "neutronBrick",
  T: "neutronBrick",
  R: "neutronBrick",
  S: "neutronBrick",
};

export const CREATURE_ORBIT_VERTICAL_SQUASH = 0.85;
export const CREATURE_BOB_AMPLITUDE = 8;
export const CREATURE_BOB_SPEED = 0.0005;
export const CONTENT_PADDING = 140;

export type LetterPattern = readonly string[];

export const LETTER_PATTERNS: Record<string, LetterPattern> = {
  V: [
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    " # # ",
    " # # ",
    "  #  ",
  ],
  O: [
    " ### ",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    " ### ",
  ],
  I: [
    "#####",
    "  #  ",
    "  #  ",
    "  #  ",
    "  #  ",
    "  #  ",
    "#####",
  ],
  D: [
    "#### ",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#   #",
    "#### ",
  ],
  E: [
    "#####",
    "#    ",
    "#    ",
    "#### ",
    "#    ",
    "#    ",
    "#####",
  ],
  A: [
    " ### ",
    "#   #",
    "#   #",
    "#####",
    "#   #",
    "#   #",
    "#   #",
  ],
  T: [
    "#######",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
    "   #  ",
  ],
  R: [
    "#### ",
    "#   #",
    "#   #",
    "#### ",
    "# #  ",
    "#  # ",
    "#   #",
  ],
  S: [
    " ####",
    "#    ",
    "#    ",
    " ### ",
    "    #",
    "    #",
    "#### ",
  ],
};
