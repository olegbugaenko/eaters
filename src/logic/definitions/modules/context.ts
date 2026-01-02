import { MapModule } from "../../modules/active-map/map/map.module";

export interface ModuleDefinitionContext {
  onAllUnitsDefeated: () => void;
  setMapModule: (mapModule: MapModule) => void;
}

export const createModuleDefinitionContext = (): ModuleDefinitionContext => {
  let mapModule: MapModule | null = null;

  return {
    onAllUnitsDefeated: () => {
      mapModule?.handleAllUnitsDefeated();
    },
    setMapModule: (instance: MapModule) => {
      mapModule = instance;
    },
  };
};
