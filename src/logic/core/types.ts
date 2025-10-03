export interface GameModule {
  readonly id: string;
  initialize(): void;
  load(data: unknown | undefined): void;
  save(): unknown;
  tick(deltaMs: number): void;
}

export interface Tickable {
  tick(deltaMs: number): void;
}

export type SaveSlotId = string;

export interface StoredSaveData {
  modules: Record<string, unknown>;
}
