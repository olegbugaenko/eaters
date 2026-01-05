/**
 * Serializes a Map of levels to a Partial Record format for save data.
 * Only includes entries where level > 0 to minimize save data size.
 *
 * @param levels - Map of ID to level values
 * @returns Partial Record with only non-zero levels
 *
 * @example
 * ```typescript
 * const levels = new Map<BuildingId, number>([['farm', 5], ['mine', 0]]);
 * const serialized = serializeLevelsMap(levels);
 * // Returns: { farm: 5 }
 * ```
 */
export const serializeLevelsMap = <TId extends string>(
  levels: Map<TId, number>
): Partial<Record<TId, number>> => {
  const serialized: Partial<Record<TId, number>> = {};
  levels.forEach((level, id) => {
    if (level > 0) {
      serialized[id] = level;
    }
  });
  return serialized;
};

/**
 * Parses levels from save data into a Map.
 * Validates data structure and sanitizes each level value.
 *
 * @param data - Raw save data (unknown)
 * @param validIds - Array of valid IDs to iterate over
 * @param createDefault - Function to create default levels Map
 * @param sanitizeFn - Function to sanitize a level value (id, rawValue) => number
 * @returns Map with parsed and sanitized levels
 *
 * @example
 * ```typescript
 * const levels = parseLevelsMapFromSaveData(
 *   data,
 *   BUILDING_IDS,
 *   createDefaultLevels,
 *   (id, raw) => sanitizeLevel(raw, getBuildingConfig(id))
 * );
 * ```
 */
export const parseLevelsMapFromSaveData = <TId extends string>(
  data: unknown | undefined,
  validIds: readonly TId[],
  createDefault: () => Map<TId, number>,
  sanitizeFn: (id: TId, rawValue: unknown) => number
): Map<TId, number> => {
  const levels = createDefault();
  if (!data || typeof data !== "object" || !("levels" in data)) {
    return levels;
  }

  const serialized = (data as { levels?: Partial<Record<TId, number>> }).levels;
  if (!serialized || typeof serialized !== "object") {
    return levels;
  }

  validIds.forEach((id) => {
    const raw = serialized[id];
    levels.set(id, sanitizeFn(id, raw));
  });

  return levels;
};

/**
 * Parses levels from save data into a Record.
 * Validates data structure and sanitizes each level value.
 * Returns null if data is invalid (for modules that need to distinguish invalid data).
 *
 * @param data - Raw save data (unknown)
 * @param validIds - Array of valid IDs to iterate over
 * @param createDefault - Function to create default levels Record
 * @param sanitizeFn - Function to sanitize a level value (id, rawValue) => number
 * @returns Record with parsed and sanitized levels, or null if data is invalid
 *
 * @example
 * ```typescript
 * const levels = parseLevelsRecordFromSaveData(
 *   data,
 *   SKILL_IDS,
 *   createDefaultLevels,
 *   (id, raw) => typeof raw === "number" ? clampLevel(raw, getSkillConfig(id)) : 0
 * );
 * ```
 */
export const parseLevelsRecordFromSaveData = <TId extends string>(
  data: unknown,
  validIds: readonly TId[],
  createDefault: () => Record<TId, number>,
  sanitizeFn: (id: TId, rawValue: unknown) => number
): Record<TId, number> | null => {
  if (!data || typeof data !== "object" || !("levels" in data)) {
    return null;
  }

  const serialized = (data as { levels?: Partial<Record<TId, number>> }).levels;
  if (!serialized || typeof serialized !== "object") {
    return null;
  }

  const levels = createDefault();
  validIds.forEach((id) => {
    const raw = serialized[id];
    levels[id] = sanitizeFn(id, raw);
  });

  return levels;
};
