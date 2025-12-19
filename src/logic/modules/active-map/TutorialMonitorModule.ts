import { DataBridge } from "../../core/DataBridge";
import { GameModule } from "../../core/types";
import { NecromancerModule } from "./NecromancerModule";
import { ResourcesModule } from "../shared/ResourcesModule";

export const TUTORIAL_MONITOR_INPUT_BRIDGE_KEY = "tutorial/monitor/input";
export const TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY = "tutorial/monitor/output";

export interface TutorialMonitorInput {
  readonly active: boolean;
  readonly stepId?: string;
  readonly actionCompleted?: boolean;
  readonly bricksRequired?: number;
}

export interface TutorialMonitorStatus {
  readonly stepId: string | null;
  readonly ready: boolean;
  readonly reason?: "sanity" | "resources";
  readonly version: number;
}

export const DEFAULT_TUTORIAL_MONITOR_STATUS: TutorialMonitorStatus = Object.freeze({
  stepId: null,
  ready: false,
  version: 0,
});

interface TutorialMonitorModuleOptions {
  readonly bridge: DataBridge;
  readonly necromancer: NecromancerModule;
  readonly resources: ResourcesModule;
}

const DEFAULT_BRICKS_REQUIRED = 3;

export class TutorialMonitorModule implements GameModule {
  public readonly id = "tutorial-monitor";

  private readonly bridge: DataBridge;
  private readonly necromancer: NecromancerModule;
  private readonly resources: ResourcesModule;

  private watch: TutorialMonitorInput = { active: false };
  private status: TutorialMonitorStatus = DEFAULT_TUTORIAL_MONITOR_STATUS;

  constructor(options: TutorialMonitorModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.resources = options.resources;

    this.bridge.subscribe<TutorialMonitorInput>(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, (next) => {
      this.handleInput(next);
    });
  }

  public initialize(): void {
    this.bridge.setValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  public reset(): void {
    this.watch = { active: false };
    this.status = DEFAULT_TUTORIAL_MONITOR_STATUS;
    this.bridge.setValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  // No persistence needed; kept for interface compatibility.
  public load(_data: unknown | undefined): void {
    this.reset();
  }

  public save(): unknown {
    return null;
  }

  public tick(_deltaMs: number): void {
    if (!this.watch.active || !this.watch.stepId) {
      return;
    }

    const ready = this.isReadyToAdvance();
    if (ready === this.status.ready) {
      return;
    }

    const version = this.status.version + 1;
    const reason = this.computeReadyReason();
    this.status = {
      stepId: this.watch.stepId,
      ready,
      reason,
      version,
    };
    this.bridge.setValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  private handleInput(input: TutorialMonitorInput): void {
    const wasActive = this.watch.active;
    this.watch = input;

    if (!input.active) {
      this.status = DEFAULT_TUTORIAL_MONITOR_STATUS;
      this.bridge.setValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
      return;
    }

    if (!wasActive) {
      // Push a reset status when entering monitoring.
      this.status = {
        stepId: input.stepId ?? null,
        ready: false,
        version: this.status.version + 1,
      };
      this.bridge.setValue(TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
    }
  }

  private isReadyToAdvance(): boolean {
    if (!this.watch.actionCompleted) {
      return false;
    }
    const sanity = this.necromancer.getResources().sanity.current;
    if (sanity <= 1) {
      return true;
    }
    const affordableSpawns = this.necromancer.getAffordableSpawnCount();
    if (affordableSpawns > 0) {
      return false;
    }
    const bricksDestroyed = this.resources.getRunBricksDestroyed();
    const requiredBricks = this.watch.bricksRequired ?? DEFAULT_BRICKS_REQUIRED;
    return bricksDestroyed >= requiredBricks;
  }

  private computeReadyReason(): TutorialMonitorStatus["reason"] {
    const sanity = this.necromancer.getResources().sanity.current;
    if (sanity <= 1) {
      return "sanity";
    }
    return "resources";
  }
}
