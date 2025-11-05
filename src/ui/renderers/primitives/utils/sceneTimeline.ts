let timelineTimeMs = 0;
let timelineInitialized = false;

const getFallbackNow = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

export const setSceneTimelineTimeMs = (timeMs: number): void => {
  if (typeof timeMs !== "number" || !Number.isFinite(timeMs)) {
    return;
  }
  timelineTimeMs = timeMs;
  timelineInitialized = true;
};

export const getSceneTimelineTimeMs = (): number => {
  if (timelineInitialized) {
    return timelineTimeMs;
  }
  return getFallbackNow();
};

export const getSceneTimelineNow = (): number => getSceneTimelineTimeMs();

