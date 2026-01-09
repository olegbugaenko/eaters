import type { StoredSaveData } from "@core/logic/types";

/**
 * Extracts time played from save data.
 * Looks for timePlayedMs in the "test-time" module data.
 */
export const extractTimePlayed = (data: StoredSaveData): number | null => {
  const moduleData = data.modules?.["test-time"];
  if (typeof moduleData !== "object" || moduleData === null) {
    return null;
  }
  if (!("timePlayedMs" in moduleData)) {
    return null;
  }
  const value = (moduleData as { timePlayedMs?: unknown }).timePlayedMs;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
