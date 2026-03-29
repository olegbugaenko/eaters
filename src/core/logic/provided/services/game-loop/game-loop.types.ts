export type TickListener = (info: { timestamp: number; deltaMs: number }) => void;

export type GameLoopPauseMode = "none" | "simulation" | "full";

export interface GameLoopUiApi {
  addTickListener(listener: TickListener): () => void;
  getLastTickTimestamp(): number;
  getPauseMode(): GameLoopPauseMode;
  setPauseMode(mode: GameLoopPauseMode): void;
  start(): void;
  stop(): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    gameLoop: GameLoopUiApi;
  }
}
