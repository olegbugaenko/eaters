import { GameModule, GameModulePauseScope } from "@core/logic/types";
import type { GameLoopPauseMode, TickListener } from "./game-loop.types";
import { TICK_INTERVAL, MAX_DELTA_MS } from "./game-loop.const";

export class GameLoop {
  private modules: Array<{
    module: GameModule;
    pauseScope: GameModulePauseScope;
  }> = [];
  private readonly registeredModuleIds = new Set<string>();
  private readonly registeredModuleInstances = new Set<GameModule>();
  private timer: number | null = null;
  private lastTick: number = 0;
  private tickListeners: Set<TickListener> = new Set();
  private visibilityChangeHandler: (() => void) | null = null;
  private pauseMode: GameLoopPauseMode = "none";

  public registerModule(
    module: GameModule,
    pauseScope: GameModulePauseScope = "mapSimulation",
  ): void {
    if (this.registeredModuleInstances.has(module)) {
      throw new Error(`GameLoop module already registered: ${module.id}`);
    }
    if (this.registeredModuleIds.has(module.id)) {
      throw new Error(`GameLoop module id already registered: ${module.id}`);
    }
    this.modules.push({ module, pauseScope });
    this.registeredModuleInstances.add(module);
    this.registeredModuleIds.add(module.id);
  }

  public addTickListener(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  public getLastTickTimestamp(): number {
    return this.lastTick;
  }

  public getPauseMode(): GameLoopPauseMode {
    return this.pauseMode;
  }

  public setPauseMode(mode: GameLoopPauseMode): void {
    this.pauseMode = mode;
  }

  /**
   * Cleans up expired objects that accumulated while the tab was inactive.
   * Called when the tab becomes visible again after being hidden.
   */
  private cleanupExpiredObjects(): void {
    // Call cleanupExpired() on modules that support it (uses absolute time)
    this.modules.forEach((module) => {
      if (typeof module.module.cleanupExpired === "function") {
        module.module.cleanupExpired();
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
      const pauseMode = this.pauseMode;
      if (pauseMode === "none") {
        this.modules.forEach(({ module }) => module.tick(delta));
      } else {
        this.modules.forEach(({ module, pauseScope }) => {
          if (pauseScope === "background") {
            module.tick(delta);
            return;
          }
          module.tickInPauseMode?.(delta, pauseMode);
        });
      }
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
    this.pauseMode = "none";
  }
}
