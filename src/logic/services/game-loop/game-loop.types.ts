export type TickListener = (info: { timestamp: number; deltaMs: number }) => void;

export interface GameLoopUiApi {
  addTickListener(listener: TickListener): () => void;
  getLastTickTimestamp(): number;
  start(): void;
  stop(): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    gameLoop: GameLoopUiApi;
  }
}
