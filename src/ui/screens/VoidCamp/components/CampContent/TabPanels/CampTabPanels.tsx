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
  onSelectMapLevel: (mapId: MapId, level: number) => void;
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
  onSelectMapLevel,
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
        onSelectLevel={onSelectMapLevel}
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
