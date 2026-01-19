import type { SceneColor } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { getAssetUrl } from "@shared/helpers/assets.helper";

export type ArcType = "heal" | "frenzy" | "freeze" | "laser" | "chainLightning";

export interface ArcConfig {
  readonly coreColor: SceneColor;
  readonly blurColor: SceneColor;
  readonly coreWidth: number;
  readonly blurWidth: number;
  readonly soundEffectUrl?: string;
  readonly lifetimeMs: number;
  readonly fadeStartMs: number;
  readonly bendsPer100Px: number;
  readonly noiseAmplitude: number;
  readonly aperiodicStrength?: number;
  readonly oscillationPeriodMs: number;
  readonly oscillationAmplitude: number;
}

const HEAL_ARC_COLOR: SceneColor = { r: 0.6, g: 1.0, b: 0.5, a: 0.65 };
const HEAL_ARC_BLUR: SceneColor = { r: 0.6, g: 0.9, b: 0.3, a: 0.55 };
const FRENZY_ARC_COLOR: SceneColor = { r: 1.0, g: 0.9, b: 0.2, a: 1.0 };
const FRENZY_ARC_BLUR: SceneColor = { r: 1.0, g: 0.4, b: 0.4, a: 0.6 };
const FREEZE_ARC_COLOR: SceneColor = { r: 0.6, g: 0.85, b: 1.0, a: 0.9 };
const FREEZE_ARC_BLUR: SceneColor = { r: 0.4, g: 0.7, b: 1.0, a: 0.5 };
const LASER_ARC_COLOR: SceneColor = { r: 1.0, g: 0.65, b: 0.7, a: 0.99 };
const LASER_ARC_BLUR: SceneColor = { r: 1.0, g: 0.65, b: 0.7, a: 0.25 };
const CHAIN_ARC_COLOR: SceneColor = { r: 0.85, g: 0.95, b: 1.0, a: 0.95 };
const CHAIN_ARC_BLUR: SceneColor = { r: 0.3, g: 0.7, b: 1.0, a: 0.35 };

const ARC_DB: Record<ArcType, ArcConfig> = {
  heal: {
    coreColor: HEAL_ARC_COLOR,
    blurColor: HEAL_ARC_BLUR,
    coreWidth: 2,
    blurWidth: 30,
    soundEffectUrl: getAssetUrl("audio/sounds/unit_effects/heal.mp3"),
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
    soundEffectUrl: getAssetUrl("audio/sounds/unit_effects/buff.mp3"),
    lifetimeMs: 1000,
    fadeStartMs: 500,
    bendsPer100Px: 2,
    noiseAmplitude: 4,
    oscillationPeriodMs: 300,
    oscillationAmplitude: 0.5,
  },
  freeze: {
    coreColor: FREEZE_ARC_COLOR,
    blurColor: FREEZE_ARC_BLUR,
    coreWidth: 2,
    blurWidth: 30,
    lifetimeMs: 900,
    fadeStartMs: 450,
    bendsPer100Px: 2.5,
    noiseAmplitude: 5,
    oscillationPeriodMs: 280,
    oscillationAmplitude: 0.6,
  },
  laser: {
    coreColor: LASER_ARC_COLOR,
    blurColor: LASER_ARC_BLUR,
    coreWidth: 1,
    blurWidth: 3,
    soundEffectUrl: getAssetUrl("audio/sounds/unit_effects/laser_02.mp3"),
    lifetimeMs: 1000,
    fadeStartMs: 450,
    bendsPer100Px: 0,
    noiseAmplitude: 0,
    oscillationPeriodMs: 0,
    oscillationAmplitude: 0.0,
  },
  chainLightning: {
    coreColor: CHAIN_ARC_COLOR,
    blurColor: CHAIN_ARC_BLUR,
    coreWidth: 0.15,
    blurWidth: 5,
    lifetimeMs: 700,
    fadeStartMs: 350,
    bendsPer100Px: 3,
    noiseAmplitude: 16,
    aperiodicStrength: 0.55,
    oscillationPeriodMs: 170,
    oscillationAmplitude: 0.4,
  },
};

export const getArcConfig = (type: ArcType): ArcConfig => {
  const config = ARC_DB[type];
  if (!config) {
    throw new Error(`Unknown arc type: ${type}`);
  }
  return config;
};
