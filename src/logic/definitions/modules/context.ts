import { MapModule } from "../../modules/map/map.module";

export interface ModuleDefinitionContext {
  onRunCompleted: (success: boolean) => void;
  onAllUnitsDefeated: () => void;
  setMapModule: (mapModule: MapModule) => void;
}
