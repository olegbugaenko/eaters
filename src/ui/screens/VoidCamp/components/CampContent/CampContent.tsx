import { useMemo, useState } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { CampTabsMenu } from "./TabMenu/CampTabsMenu";
import { CampTabPanels } from "./TabPanels/CampTabPanels";
import "./CampContent.css";

export type CampTabKey = "maps" | "skills";

interface CampContentProps {
  maps: MapListEntry[];
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onStart: () => void;
  onExit: () => void;
  timePlayed: number;
  brickCount: number;
}

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const CampContent: React.FC<CampContentProps> = ({
  maps,
  selectedMap,
  onSelectMap,
  onStart,
  onExit,
  timePlayed,
  brickCount,
}) => {
  const [activeTab, setActiveTab] = useState<CampTabKey>("maps");
  const formattedTime = useMemo(() => formatTime(timePlayed), [timePlayed]);

  return (
    <div className="camp-content surface-panel stack-lg">
      <header className="camp-content__header">
        <h1 className="heading-1">Void Camp</h1>
        <CampTabsMenu activeTab={activeTab} onChange={setActiveTab} />
      </header>
      <CampTabPanels
        activeTab={activeTab}
        maps={maps}
        selectedMap={selectedMap}
        onSelectMap={onSelectMap}
        onStart={onStart}
        onExit={onExit}
        formattedTime={formattedTime}
        brickCount={brickCount}
      />
    </div>
  );
};
