import { GameModule } from "@core/logic/types";
import type { TickListener } from "./game-loop.types";
import { TICK_INTERVAL, MAX_DELTA_MS } from "./game-loop.const";

export class GameLoop {
  private modules: GameModule[] = [];
  private timer: number | null = null;
  private lastTick: number = 0;
  private tickListeners: Set<TickListener> = new Set();
  private visibilityChangeHandler: (() => void) | null = null;

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

  /**
   * Cleans up expired objects that accumulated while the tab was inactive.
   * Called when the tab becomes visible again after being hidden.
   */
  private cleanupExpiredObjects(): void {
    // Call cleanupExpired() on modules that support it (uses absolute time)
    this.modules.forEach((module) => {
      if (typeof module.cleanupExpired === "function") {
        module.cleanupExpired();
      }
    });
  }

  public start(): void {
    if (this.timer !== null) {
      return;
    }
    this.lastTick = performance.now();
    
    // Handle visibility change to cleanup expired objects when tab becomes active
    this.visibilityChangeHandler = () => {
      if (!document.hidden) {
        // Tab became visible - cleanup expired objects
        this.cleanupExpiredObjects();
        // Update lastTick to prevent huge delta on next tick
        this.lastTick = performance.now();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
    
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const deltaRaw = now - this.lastTick;
      // Clamp delta to avoid huge updates after background tab throttling
      const delta = Math.min(Math.max(deltaRaw, 0), MAX_DELTA_MS);
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
    if (this.visibilityChangeHandler !== null) {
      document.removeEventListener("visibilitychange", this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
  }
}
