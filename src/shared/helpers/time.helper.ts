/**
 * Returns current time in milliseconds.
 * Uses performance.now() if available (more precise, relative to page load),
 * otherwise falls back to Date.now() (absolute time).
 */
export const getNowMs = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};
