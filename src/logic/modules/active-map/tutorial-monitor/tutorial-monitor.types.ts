import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { ResourcesModule } from "../../shared/resources/resources.module";
import type { MapRunState } from "../map/MapRunState";

export interface TutorialMonitorInput {
  readonly active: boolean;
  readonly stepId?: string;
  readonly actionCompleted?: boolean;
  readonly bricksRequired?: number;
  readonly attacksRequired?: number;
}

export interface TutorialMonitorStatus {
  readonly stepId: string | null;
  readonly ready: boolean;
  readonly reason?: "sanity" | "resources" | "attacks";
  readonly version: number;
}

export interface TutorialMonitorModuleOptions {
  readonly bridge: DataBridge;
  readonly necromancer: NecromancerModule;
  readonly resources: ResourcesModule;
  readonly runState: MapRunState;
}
