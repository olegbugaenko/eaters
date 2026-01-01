import { MapModule } from "../../../modules/active-map/MapModule";

export interface ModuleDefinitionContext {
  onRunCompleted: (success: boolean) => void;
  onAllUnitsDefeated: () => void;
  setMapModule: (mapModule: MapModule) => void;
}
