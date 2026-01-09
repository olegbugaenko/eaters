export interface GameModule {
  readonly id: string;
  initialize(): void;
  reset(): void;
  load(data: unknown | undefined): void;
  save(): unknown;
  tick(deltaMs: number): void;
  /**
   * Optional method to cleanup expired objects when tab becomes visible after being inactive.
   * Uses absolute time (performance.now()) instead of elapsedMs to handle tab inactivity correctly.
   */
  cleanupExpired?(): void;
}

export interface Tickable {
  tick(deltaMs: number): void;
}

export type SaveSlotId = string;

export interface SaveSlotMetadata {
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface StoredSaveData {
  modules: Record<string, unknown>;
  meta?: SaveSlotMetadata;
}
