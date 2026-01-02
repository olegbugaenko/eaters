export type MapRunPhase = "idle" | "running" | "paused" | "completed";

export interface MapRunStatus {
  readonly phase: MapRunPhase;
  readonly paused: boolean;
  readonly completed: boolean;
}

export type MapRunEvent =
  | { type: "start" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "reset" }
  | { type: "complete"; success: boolean };

type MapRunListener = (event: MapRunEvent, status: MapRunStatus) => void;

export class MapRunState {
  private phase: MapRunPhase = "idle";

  private readonly listeners = new Set<MapRunListener>();

  public subscribe(listener: MapRunListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public reset(): boolean {
    const changed = this.phase !== "idle";
    this.phase = "idle";
    if (changed) {
      this.emit({ type: "reset" });
    }
    return changed;
  }

  public start(): boolean {
    if (this.phase === "running") {
      return false;
    }
    this.phase = "running";
    this.emit({ type: "start" });
    return true;
  }

  public pause(): boolean {
    if (this.phase !== "running") {
      return false;
    }
    this.phase = "paused";
    this.emit({ type: "pause" });
    return true;
  }

  public resume(): boolean {
    if (this.phase !== "paused") {
      return false;
    }
    this.phase = "running";
    this.emit({ type: "resume" });
    return true;
  }

  public complete(success: boolean): boolean {
    if (this.phase === "completed") {
      return false;
    }
    this.phase = "completed";
    this.emit({ type: "complete", success });
    return true;
  }

  public getPhase(): MapRunPhase {
    return this.phase;
  }

  public isIdle(): boolean {
    return this.phase === "idle";
  }

  public isRunning(): boolean {
    return this.phase === "running";
  }

  public isPaused(): boolean {
    return this.phase === "paused" || this.phase === "completed";
  }

  public isCompleted(): boolean {
    return this.phase === "completed";
  }

  public shouldProcessTick(): boolean {
    return this.phase !== "paused" && this.phase !== "completed";
  }

  public getStatus(): MapRunStatus {
    return {
      phase: this.phase,
      paused: this.isPaused(),
      completed: this.isCompleted(),
    };
  }

  private emit(event: MapRunEvent): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(event, status));
  }
}
