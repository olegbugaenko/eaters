import { GameModule } from "../core/types";

const TICK_INTERVAL = 100;

export class GameLoop {
  private modules: GameModule[] = [];
  private timer: number | null = null;
  private lastTick: number = 0;

  public registerModule(module: GameModule): void {
    this.modules.push(module);
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }
    this.lastTick = performance.now();
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this.modules.forEach((module) => module.tick(delta));
    }, TICK_INTERVAL);
  }

  public stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
