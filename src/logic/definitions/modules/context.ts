import { MapModule } from "../../modules/active-map/map/map.module";

export interface ModuleDefinitionContext {
  onAllUnitsDefeated: () => void;
  setMapModule: (mapModule: MapModule) => void;
}
