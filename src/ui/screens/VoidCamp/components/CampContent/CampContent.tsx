import { useCallback, useEffect, useMemo, useState } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { CampTabsMenu } from "./TabMenu/CampTabsMenu";
import { CampTabPanels } from "./TabPanels/CampTabPanels";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/UnitModuleWorkshopModule";
import { UnitDesignerBridgeState } from "@logic/modules/UnitDesignModule";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import { formatDuration } from "@ui/utils/formatDuration";
import { BuildingsWorkshopBridgeState } from "@logic/modules/BuildingsModule";
import { CraftingBridgeState } from "@logic/modules/CraftingModule";
import { UnitAutomationBridgeState } from "@logic/modules/UnitAutomationModule";
import "./CampContent.css";

export type CampTabKey = "maps" | "skills" | "modules" | "buildings" | "crafting";

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
  unitAutomationState: UnitAutomationBridgeState;
  buildingsState: BuildingsWorkshopBridgeState;
  craftingState: CraftingBridgeState;
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
  unitAutomationState,
  buildingsState,
  craftingState,
}) => {
  const [activeTab, setActiveTab] = useState<CampTabKey>(initialTab);
  const fallbackTab = useMemo<CampTabKey>(() => {
    if (initialTab === "maps" || initialTab === "skills") {
      return initialTab;
    }
    return "maps";
  }, [initialTab]);
  const sanitizeTab = useCallback(
    (tab: CampTabKey): CampTabKey => {
      if (tab === "modules" && !moduleWorkshopState.unlocked) {
        return fallbackTab;
      }
      if (tab === "buildings" && !buildingsState.unlocked) {
        return fallbackTab;
      }
      if (tab === "crafting" && !craftingState.unlocked) {
        return fallbackTab;
      }
      return tab;
    },
    [moduleWorkshopState.unlocked, buildingsState.unlocked, craftingState.unlocked, fallbackTab]
  );
  useEffect(() => {
    setActiveTab(sanitizeTab(initialTab));
  }, [initialTab, sanitizeTab]);
  useEffect(() => {
    setActiveTab((current) => sanitizeTab(current));
  }, [sanitizeTab]);
  const formattedTime = useMemo(() => formatDuration(timePlayed), [timePlayed]);
  const handleTabChange = useCallback(
    (tab: CampTabKey) => {
      const sanitized = sanitizeTab(tab);
      setActiveTab(sanitized);
      onTabChange?.(sanitized);
    },
    [onTabChange, sanitizeTab]
  );

  return (
    <div className="camp-content surface-panel stack-lg">
      <header className="camp-content__header">
        <CampTabsMenu
          activeTab={activeTab}
          onChange={handleTabChange}
          modulesUnlocked={moduleWorkshopState.unlocked}
          buildingsUnlocked={buildingsState.unlocked}
          craftingUnlocked={craftingState.unlocked}
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
        unitAutomationState={unitAutomationState}
        buildingsState={buildingsState}
        craftingState={craftingState}
      />
    </div>
  );
};
