import type { GameLoopPauseMode } from "@core/logic/provided/services/game-loop/game-loop.types";

export type GameModulePauseScope = "mapSimulation" | "background";

export interface GameModule {
  readonly id: string;
  initialize(): void;
  reset(): void;
  load(data: unknown | undefined): void;
  save(): unknown;
  tick(deltaMs: number): void;
  /**
   * Optional tick path for pause modes that keep presentation modules alive
   * without resuming the full gameplay simulation.
   */
  tickInPauseMode?(deltaMs: number, mode: Exclude<GameLoopPauseMode, "none">): void;
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
