import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { SkillTreeView } from "@screens/VoidCamp/components/SkillTree/SkillTreeView";
import { ModulesWorkshopView } from "@screens/VoidCamp/components/ModulesWorkshop/ModulesWorkshopView";
import { CampTabKey } from "../CampContent";
import { MapSelectPanel } from "./MapSelectPanel/MapSelectPanel";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/UnitModuleWorkshopModule";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import "./CampTabPanels.css";

type CampTabPanelsProps = {
  activeTab: CampTabKey;
  maps: MapListEntry[];
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onSelectMapLevel: (mapId: MapId, level: number) => void;
  onStart: () => void;
  onExit: () => void;
  formattedTime: string;
  brickCount: number;
  moduleWorkshopState: UnitModuleWorkshopBridgeState;
  resourceTotals: ResourceAmountPayload[];
};

export const CampTabPanels: React.FC<CampTabPanelsProps> = ({
  activeTab,
  maps,
  selectedMap,
  onSelectMap,
  onSelectMapLevel,
  onStart,
  onExit,
  formattedTime,
  brickCount,
  moduleWorkshopState,
  resourceTotals,
}) => {
  if (activeTab === "maps") {
    return (
      <MapSelectPanel
        maps={maps}
        selectedMap={selectedMap}
        onSelectMap={onSelectMap}
        onSelectLevel={onSelectMapLevel}
        onStart={onStart}
        onExit={onExit}
        formattedTime={formattedTime}
        brickCount={brickCount}
      />
    );
  }

  if (activeTab === "modules") {
    if (!moduleWorkshopState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">Modules Unavailable</h2>
          <p className="body-md text-muted">
            Unlock the Void Module Fabrication skill to access module fabrication and upgrades.
          </p>
        </div>
      );
    }

    return (
      <div className="camp-tab-panels__modules">
        <ModulesWorkshopView state={moduleWorkshopState} resources={resourceTotals} />
      </div>
    );
  }

  return (
    <div className="camp-tab-panels__skill-tree">
      <SkillTreeView />
    </div>
  );
};
