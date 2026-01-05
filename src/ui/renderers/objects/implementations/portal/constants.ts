import type { SceneFill } from "@/logic/services/scene-object-manager/scene-object-manager.types";
import { FILL_TYPES } from "@/logic/services/scene-object-manager/scene-object-manager.const";
import type { PortalEmitterConfig } from "./types";

export const DEFAULT_PORTAL_FILL: SceneFill = {
  fillType: FILL_TYPES.RADIAL_GRADIENT,
  start: { x: 0, y: 0 },
  end: 18,
  stops: [
    { offset: 0, color: { r: 0.4, g: 0.7, b: 1, a: 0.6 } },
    { offset: 0.45, color: { r: 0.25, g: 0.5, b: 0.9, a: 0.35 } },
    { offset: 1, color: { r: 0.15, g: 0.25, b: 0.7, a: 0 } },
  ],
};

export const DEFAULT_PORTAL_EMITTER: PortalEmitterConfig = {
  particlesPerSecond: 90,
  particleLifetimeMs: 900,
  fadeStartMs: 450,
  emissionDurationMs: 900,
  sizeRange: { min: 1, max: 3 },
  offset: { x: 0, y: 0 },
  color: { r: 0.4, g: 0.8, b: 1, a: 0.9 },
  fill: undefined,
  shape: "circle",
  capacity: 100,
  baseSpeed: 0.06,
  speedVariation: 0.04,
};

export const DEFAULT_PORTAL_RADIUS = 18;
export const DEFAULT_PORTAL_SEGMENTS = 48;
