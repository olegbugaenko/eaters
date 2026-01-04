// Re-export helpers for backward compatibility
// These functions are now in their respective helper files
export { cloneSceneColor, sanitizeSceneColor } from "../../helpers/scene-color.helper";
export { cloneSceneFill } from "../../helpers/scene-fill.helper";
export { normalizeAngle, sanitizeAngle, sanitizeArc } from "../../helpers/angle.helper";

export type ParticleEmitterShape = "square" | "circle" | "triangle";
