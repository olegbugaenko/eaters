import type { SceneColor } from "../logic/services/scene-object-manager/scene-object-manager.types";

export type ArcType = "heal" | "frenzy";

export interface ArcConfig {
  readonly coreColor: SceneColor;
  readonly blurColor: SceneColor;
  readonly coreWidth: number;
  readonly blurWidth: number;
  readonly lifetimeMs: number;
  readonly fadeStartMs: number;
  readonly bendsPer100Px: number;
  readonly noiseAmplitude: number;
  readonly oscillationPeriodMs: number;
  readonly oscillationAmplitude: number;
}

const HEAL_ARC_COLOR: SceneColor = { r: 0.6, g: 1.0, b: 0.5, a: 0.65 };
const HEAL_ARC_BLUR: SceneColor = { r: 0.6, g: 0.9, b: 0.3, a: 0.55 };
const FRENZY_ARC_COLOR: SceneColor = { r: 1.0, g: 0.9, b: 0.2, a: 1.0 };
const FRENZY_ARC_BLUR: SceneColor = { r: 1.0, g: 0.4, b: 0.4, a: 0.6 };

const ARC_DB: Record<ArcType, ArcConfig> = {
  heal: {
    coreColor: HEAL_ARC_COLOR,
    blurColor: HEAL_ARC_BLUR,
    coreWidth: 2,
    blurWidth: 30,
    lifetimeMs: 1000,
    fadeStartMs: 500,
    bendsPer100Px: 2,
    noiseAmplitude: 4,
    oscillationPeriodMs: 200,
    oscillationAmplitude: 0.5,
  },
  frenzy: {
    coreColor: FRENZY_ARC_COLOR,
    blurColor: FRENZY_ARC_BLUR,
    coreWidth: 2,
    blurWidth: 25,
    lifetimeMs: 1000,
    fadeStartMs: 500,
    bendsPer100Px: 2,
    noiseAmplitude: 4,
    oscillationPeriodMs: 300,
    oscillationAmplitude: 0.5,
  },
};

export const getArcConfig = (type: ArcType): ArcConfig => {
  const config = ARC_DB[type];
  if (!config) {
    throw new Error(`Unknown arc type: ${type}`);
  }
  return config;
};

