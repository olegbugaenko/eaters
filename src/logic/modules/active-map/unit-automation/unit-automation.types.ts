import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { PlayerUnitType } from "../../../../db/player-units-db";
import type { NecromancerModule } from "../necromancer/necromancer.module";
import type { UnitDesignId } from "../../camp/unit-design/unit-design.types";
import type { UnitDesignModule } from "../../camp/unit-design/unit-design.module";
import type { SkillId } from "../../../../db/skills-db";
import type { MapRunState } from "../map/MapRunState";

export interface UnitAutomationUnitState {
  readonly designId: UnitDesignId;
  readonly type: PlayerUnitType;
  readonly name: string;
  readonly enabled: boolean;
  readonly weight: number;
}

export interface UnitAutomationBridgeState {
  readonly unlocked: boolean;
  readonly units: readonly UnitAutomationUnitState[];
}

export interface UnitAutomationModuleOptions {
  bridge: DataBridge;
  necromancer: Pick<
    NecromancerModule,
    "trySpawnDesign" | "getResources" | "getRemainingUnitCapacity"
  >;
  unitDesigns: Pick<
    UnitDesignModule,
    "subscribe" | "getDefaultDesignForType" | "getActiveRosterDesigns"
  >;
  getUnitCountByDesignId: (designId: UnitDesignId) => number;
  getSkillLevel: (id: SkillId) => number;
  runState: MapRunState;
  isRunActive: () => boolean;
}

export interface UnitAutomationSaveData {
  readonly enabled?: Record<string, boolean>;
  readonly weights?: Record<string, number>;
}

export interface AutomationSelectionCandidate {
  readonly designId: UnitDesignId;
  readonly weight: number;
  readonly activeCount: number;
  readonly order: number;
}

export type AutomationAvailability = "affordable" | "wait" | "skip";

export interface UnitAutomationModuleUiApi {
  setAutomationEnabled(designId: UnitDesignId, enabled: boolean): void;
  setAutomationWeight(designId: UnitDesignId, weight: number): void;
}

declare module "@core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    unitAutomation: UnitAutomationModuleUiApi;
  }
}
