/**
 * Уніфіковані функції валідації та санітизації значень.
 * Централізовані утиліти для перевірки та нормалізації даних з різних джерел.
 */

/**
 * Sanitizes a level value, ensuring it's a valid positive integer >= 1.
 * @param value - Value to sanitize
 * @param defaultValue - Default value to return if invalid (default: 1)
 * @returns Sanitized level value
 */
export const sanitizeLevel = (value: unknown, defaultValue = 1): number => {
  if (!Number.isFinite(value as number)) {
    return defaultValue;
  }
  const level = Math.floor(Number(value));
  return Math.max(level, 1);
};

/**
 * Sanitizes a count value, ensuring it's a valid non-negative integer.
 * @param value - Value to sanitize
 * @param defaultValue - Default value to return if invalid (default: 0)
 * @returns Sanitized count value
 */
export const sanitizeCount = (value: unknown, defaultValue = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return defaultValue;
  }
  return Math.floor(value);
};

/**
 * Sanitizes a rotation value, ensuring it's a valid finite number.
 * @param value - Value to sanitize
 * @param defaultValue - Default value to return if invalid (default: random 0-2π)
 * @returns Sanitized rotation value
 */
export const sanitizeRotation = (value: number | undefined, defaultValue?: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  return Math.random() * Math.PI * 2;
};

