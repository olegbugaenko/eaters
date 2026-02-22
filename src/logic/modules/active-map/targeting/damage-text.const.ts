/**
 * Tunable parameters for floating damage text.
 *
 * You can tweak these values to balance readability/performance:
 * - `lifetimeMs`: How long one text lives before fading out.
 * - `riseSpeedWorldUnitsPerSecond`: Upward movement speed in world units/sec.
 * - `fontSizePx`: Base font size in screen-space pixels.
 * - `maxConcurrentTexts`: Max active texts rendered at once.
 * - `aggregationWindowMs`: Time window for merging repeated hits on same target.
 */
export const DAMAGE_TEXT_TUNING = {
  lifetimeMs: 900,
  riseSpeedWorldUnitsPerSecond: 34,
  fontSizePx: 18,
  maxConcurrentTexts: 80,
  aggregationWindowMs: 100,
} as const;

export const DAMAGE_TEXT_BRIDGE_KEY = "combat/floatingDamageText" as const;
