/**
 * Normalizes an angle to [0, 2π) range.
 * Handles non-finite values by returning 0.
 */
export const normalizeAngle = (angle: number): number => {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  const wrapped = angle % (Math.PI * 2);
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped;
};

/**
 * Sanitizes an angle value with a fallback.
 * Normalizes the result to [0, 2π) range.
 */
export const sanitizeAngle = (
  value: number | undefined,
  fallback = 0
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return normalizeAngle(fallback);
  }
  return normalizeAngle(value);
};

/**
 * Sanitizes an arc value, clamping it to [min, max] range.
 * Returns max if value is not a finite number.
 */
export const sanitizeArc = (
  value: number | undefined,
  min = 0,
  max = Math.PI * 2
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return max;
  }
  if (value <= min) {
    return min;
  }
  if (value >= max) {
    return max;
  }
  return value;
};

/**
 * Normalizes a rotation value to [0, 2π) range.
 * Returns fallback (default 0) if value is not a finite number.
 */
export const normalizeRotation = (
  value: number | undefined,
  fallback = 0
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return normalizeAngle(fallback);
  }
  if (value === 0) {
    return 0;
  }
  const normalized = normalizeAngle(value);
  return normalized === 0 ? 0 : normalized;
};
