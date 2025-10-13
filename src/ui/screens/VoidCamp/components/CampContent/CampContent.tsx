import { useCallback, useEffect, useMemo, useState } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { CampTabsMenu } from "./TabMenu/CampTabsMenu";
import { CampTabPanels } from "./TabPanels/CampTabPanels";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/UnitModuleWorkshopModule";
import { UnitDesignerBridgeState } from "@logic/modules/UnitDesignModule";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import { formatDuration } from "@ui/utils/formatDuration";
import "./CampContent.css";

export type CampTabKey = "maps" | "skills" | "modules";

interface CampContentProps {
  maps: MapListEntry[];
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onSelectMapLevel: (mapId: MapId, level: number) => void;
  onStart: () => void;
  onExit: () => void;
  timePlayed: number;
  brickCount: number;
  initialTab: CampTabKey;
  onTabChange?: (tab: CampTabKey) => void;
  resourceTotals: ResourceAmountPayload[];
  moduleWorkshopState: UnitModuleWorkshopBridgeState;
  unitDesignerState: UnitDesignerBridgeState;
}

export const CampContent: React.FC<CampContentProps> = ({
  maps,
  selectedMap,
  onSelectMap,
  onSelectMapLevel,
  onStart,
  onExit,
  timePlayed,
  brickCount,
  initialTab,
  onTabChange,
  resourceTotals,
  moduleWorkshopState,
  unitDesignerState,
}) => {
  const [activeTab, setActiveTab] = useState<CampTabKey>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (!moduleWorkshopState.unlocked) {
      setActiveTab((current) => {
        if (current !== "modules") {
          return current;
        }
        return initialTab === "maps" ? "maps" : "skills";
      });
    }
  }, [moduleWorkshopState.unlocked, initialTab]);
  const formattedTime = useMemo(() => formatDuration(timePlayed), [timePlayed]);
  const handleTabChange = useCallback(
    (tab: CampTabKey) => {
      if (tab === "modules" && !moduleWorkshopState.unlocked) {
        return;
      }
      setActiveTab(tab);
      onTabChange?.(tab);
    },
    [onTabChange, moduleWorkshopState.unlocked]
  );

  return (
    <div className="camp-content surface-panel stack-lg">
      <header className="camp-content__header">
        <CampTabsMenu
          activeTab={activeTab}
          onChange={handleTabChange}
          modulesUnlocked={moduleWorkshopState.unlocked}
        />
      </header>
      <CampTabPanels
        activeTab={activeTab}
        maps={maps}
        selectedMap={selectedMap}
        onSelectMap={onSelectMap}
        onSelectMapLevel={onSelectMapLevel}
        onStart={onStart}
        onExit={onExit}
        formattedTime={formattedTime}
        brickCount={brickCount}
        moduleWorkshopState={moduleWorkshopState}
        resourceTotals={resourceTotals}
        unitDesignerState={unitDesignerState}
      />
    </div>
  );
};
