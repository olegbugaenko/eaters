export type MapRunPhase = "idle" | "running" | "paused" | "completed";

export interface MapRunStatus {
  readonly phase: MapRunPhase;
  readonly paused: boolean;
  readonly completed: boolean;
}

export class MapRunState {
  private phase: MapRunPhase = "idle";

  public reset(): void {
    this.phase = "idle";
  }

  public start(): void {
    this.phase = "running";
  }

  public pause(): void {
    if (this.phase === "running") {
      this.phase = "paused";
    }
  }

  public resume(): void {
    if (this.phase === "paused") {
      this.phase = "running";
    }
  }

  public complete(): boolean {
    this.phase = "completed";
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
}
