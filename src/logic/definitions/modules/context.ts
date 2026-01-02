import { MapModule } from "../../modules/active-map/map/map.module";

export interface ModuleDefinitionContext {
  onRunCompleted: (success: boolean) => void;
  onAllUnitsDefeated: () => void;
  setMapModule: (mapModule: MapModule) => void;
}
