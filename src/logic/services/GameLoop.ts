import { GameModule } from "../core/types";

export const TICK_INTERVAL = 100;

type TickListener = (info: { timestamp: number; deltaMs: number }) => void;

export class GameLoop {
  private modules: GameModule[] = [];
  private timer: number | null = null;
  private lastTick: number = 0;
  private tickListeners: Set<TickListener> = new Set();

  public registerModule(module: GameModule): void {
    this.modules.push(module);
  }

  public addTickListener(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  public getLastTickTimestamp(): number {
    return this.lastTick;
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }
    this.lastTick = performance.now();
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const deltaRaw = now - this.lastTick;
      // Clamp delta to avoid huge updates after background tab throttling
      const delta = Math.min(Math.max(deltaRaw, 0), 200);
      this.lastTick = now;
      this.modules.forEach((module) => module.tick(delta));
      this.tickListeners.forEach((listener) =>
        listener({ timestamp: now, deltaMs: delta })
      );
    }, TICK_INTERVAL);
  }

  public stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
