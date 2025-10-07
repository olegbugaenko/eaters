import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { SkillTreeView } from "@screens/VoidCamp/components/SkillTree/SkillTreeView";
import { CampTabKey } from "../CampContent";
import { MapSelectPanel } from "./MapSelectPanel/MapSelectPanel";
import "./CampTabPanels.css";

type CampTabPanelsProps = {
  activeTab: CampTabKey;
  maps: MapListEntry[];
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onStart: () => void;
  onExit: () => void;
  formattedTime: string;
  brickCount: number;
};

export const CampTabPanels: React.FC<CampTabPanelsProps> = ({
  activeTab,
  maps,
  selectedMap,
  onSelectMap,
  onStart,
  onExit,
  formattedTime,
  brickCount,
}) => {
  if (activeTab === "maps") {
    return (
      <MapSelectPanel
        maps={maps}
        selectedMap={selectedMap}
        onSelectMap={onSelectMap}
        onStart={onStart}
        onExit={onExit}
        formattedTime={formattedTime}
        brickCount={brickCount}
      />
    );
  }

  return (
    <div className="camp-tab-panels__skill-tree">
      <SkillTreeView />
    </div>
  );
};
