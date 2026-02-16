import { useCallback, useEffect, useMemo, useState } from "react";
import { MapId } from "@/db/maps/maps-db";
import { MapListEntry, MapResourcePreviewCache } from "@logic/modules/active-map/map/map.types";
import { CampTabsMenu } from "./TabMenu/CampTabsMenu";
import { CampTabPanels } from "./TabPanels/CampTabPanels";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/buildings/buildings.types";
import { CraftingBridgeState } from "@logic/modules/camp/crafting/crafting.types";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import { AchievementsBridgePayload } from "@logic/modules/shared/achievements/achievements.types";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import {
  CampTabKey,
  CampTopLevelTabKey,
  buildCampTabHasNew,
  sanitizeCampTab,
} from "./CampContent.helpers";
import "./CampContent.css";

export type { CampTabKey } from "./CampContent.helpers";

interface CampContentProps {
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  mapResourcePreviewCache: MapResourcePreviewCache;
  onSelectMap: (mapId: MapId) => void;
  onSelectMapLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
  initialTab: CampTabKey;
  onTabChange?: (tab: CampTopLevelTabKey) => void;
  resourceTotals: ResourceAmountPayload[];
  moduleWorkshopState: UnitModuleWorkshopBridgeState;
  unitDesignerState: UnitDesignerBridgeState;
  unitAutomationState: UnitAutomationBridgeState;
  buildingsState: BuildingsWorkshopBridgeState;
  craftingState: CraftingBridgeState;
  achievementsState: AchievementsBridgePayload;
  newUnlocksState: NewUnlockNotificationBridgeState;
}

export const CampContent: React.FC<CampContentProps> = ({
  maps,
  clearedLevelsTotal,
  selectedMap,
  mapResourcePreviewCache,
  onSelectMap,
  onSelectMapLevel,
  onStartMap,
  initialTab,
  onTabChange,
  resourceTotals,
  moduleWorkshopState,
  unitDesignerState,
  unitAutomationState,
  buildingsState,
  craftingState,
  achievementsState,
  newUnlocksState,
}) => {
  const [activeTab, setActiveTab] = useState<CampTopLevelTabKey>(() => sanitizeCampTab(initialTab, {
    moduleWorkshopUnlocked: moduleWorkshopState.unlocked,
    buildingsUnlocked: buildingsState.unlocked,
    craftingUnlocked: craftingState.unlocked,
  }, initialTab === "maps" || initialTab === "skills" ? initialTab : "maps"));
  const fallbackTab = useMemo<CampTopLevelTabKey>(() => {
    if (initialTab === "maps" || initialTab === "skills") {
      return initialTab;
    }
    return "maps";
  }, [initialTab]);
  const sanitizeTab = useCallback(
    (tab: CampTabKey): CampTopLevelTabKey =>
      sanitizeCampTab(
        tab,
        {
          moduleWorkshopUnlocked: moduleWorkshopState.unlocked,
          buildingsUnlocked: buildingsState.unlocked,
          craftingUnlocked: craftingState.unlocked,
        },
        fallbackTab
      ),
    [moduleWorkshopState.unlocked, buildingsState.unlocked, craftingState.unlocked, fallbackTab]
  );
  useEffect(() => {
    setActiveTab(sanitizeTab(initialTab));
  }, [initialTab, sanitizeTab]);
  useEffect(() => {
    setActiveTab((current) => sanitizeTab(current));
  }, [sanitizeTab]);
  const handleTabChange = useCallback(
    (tab: CampTopLevelTabKey) => {
      const sanitized = sanitizeTab(tab);
      setActiveTab(sanitized);
      onTabChange?.(sanitized);
    },
    [onTabChange, sanitizeTab]
  );
  const tabHasNew = useMemo(
    () => buildCampTabHasNew(newUnlocksState.unseenByPrefix),
    [newUnlocksState.unseenByPrefix]
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
          tabHasNew={tabHasNew}
        />
      </header>
      <CampTabPanels
        activeTab={activeTab}
        maps={maps}
        clearedLevelsTotal={clearedLevelsTotal}
        selectedMap={selectedMap}
        mapResourcePreviewCache={mapResourcePreviewCache}
        onSelectMap={onSelectMap}
        onSelectMapLevel={onSelectMapLevel}
        onStartMap={onStartMap}
        moduleWorkshopState={moduleWorkshopState}
        resourceTotals={resourceTotals}
        unitDesignerState={unitDesignerState}
        unitAutomationState={unitAutomationState}
        buildingsState={buildingsState}
        craftingState={craftingState}
        achievementsState={achievementsState}
        newUnlocksState={newUnlocksState}
      />
    </div>
  );
};
