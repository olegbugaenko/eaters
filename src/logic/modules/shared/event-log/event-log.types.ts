export type EventLogEntryType = "map-cleared" | "skill-obtained" | "artifact-unlocked";

export interface EventLogEntryPayload {
  readonly mapId?: string;
  readonly level?: number;
  readonly skillId?: string;
  /** Fallback when skill has no registerEventText in locale */
  readonly eventDescription?: string;
}

export interface EventLogEntry {
  readonly realTimeMs: number;
  readonly gameTimeMs: number;
  readonly type: EventLogEntryType;
  readonly text: string;
  /** When set, UI can format localized text from this instead of using text */
  readonly payload?: EventLogEntryPayload;
}

export interface EventLogSaveData {
  events?: EventLogEntry[];
}
