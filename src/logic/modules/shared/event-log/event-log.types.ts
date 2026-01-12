export type EventLogEntryType = "map-cleared" | "skill-obtained";

export interface EventLogEntry {
  readonly realTimeMs: number;
  readonly gameTimeMs: number;
  readonly type: EventLogEntryType;
  readonly text: string;
}

export interface EventLogSaveData {
  events?: EventLogEntry[];
}
