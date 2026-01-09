import { GameModule } from "@core/logic/types";
import type {
  TutorialMonitorInput,
  TutorialMonitorStatus,
  TutorialMonitorModuleOptions,
} from "./tutorial-monitor.types";
import {
  TUTORIAL_MONITOR_INPUT_BRIDGE_KEY,
  TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY,
  DEFAULT_TUTORIAL_MONITOR_STATUS,
  DEFAULT_BRICKS_REQUIRED,
} from "./tutorial-monitor.const";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { MapRunState } from "../map/MapRunState";

export class TutorialMonitorModule implements GameModule {
  public readonly id = "tutorial-monitor";

  private readonly bridge: DataBridge;
  private readonly necromancer: NecromancerModule;
  private readonly resources: ResourcesModule;
  private readonly runState: MapRunState;

  private watch: TutorialMonitorInput = { active: false };
  private status: TutorialMonitorStatus = DEFAULT_TUTORIAL_MONITOR_STATUS;

  constructor(options: TutorialMonitorModuleOptions) {
    this.bridge = options.bridge;
    this.necromancer = options.necromancer;
    this.resources = options.resources;
    this.runState = options.runState;

    this.bridge.subscribe(TUTORIAL_MONITOR_INPUT_BRIDGE_KEY, (next) => {
      this.handleInput(next);
    });
  }

  public initialize(): void {
    DataBridgeHelpers.pushState(this.bridge, TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  public reset(): void {
    this.watch = { active: false };
    this.status = DEFAULT_TUTORIAL_MONITOR_STATUS;
    DataBridgeHelpers.pushState(this.bridge, TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  // No persistence needed; kept for interface compatibility.
  public load(_data: unknown | undefined): void {
    this.reset();
  }

  public save(): unknown {
    return null;
  }

  public tick(_deltaMs: number): void {
    if (!this.runState.shouldProcessTick()) {
      return;
    }
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
    DataBridgeHelpers.pushState(this.bridge, TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
  }

  private handleInput(input: TutorialMonitorInput): void {
    const wasActive = this.watch.active;
    this.watch = input;

    if (!input.active) {
      this.status = DEFAULT_TUTORIAL_MONITOR_STATUS;
      DataBridgeHelpers.pushState(this.bridge, TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
      return;
    }

    if (!wasActive) {
      // Push a reset status when entering monitoring.
      this.status = {
        stepId: input.stepId ?? null,
        ready: false,
        version: this.status.version + 1,
      };
      DataBridgeHelpers.pushState(this.bridge, TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY, this.status);
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
