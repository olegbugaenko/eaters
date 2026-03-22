import { useEffect, useMemo, useState } from "react";
import { MapId, getMapConfig } from "@/db/maps/maps-db";
import { MapListEntry, MapResourcePreviewCache } from "@logic/modules/active-map/map/map.types";
import { SkillTreeView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/SkillTree/SkillTreeView";
import { ModulesWorkshopView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/ModulesWorkshop/ModulesWorkshopView";
import { UnitDesignerView } from "@screens/VoidCamp/components/UnitDesigner/UnitDesignerView";
import { CampTabKey } from "../CampContent.helpers";
import { MapSelectPanel } from "./MapSelectPanel/MapSelectPanel";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/buildings/buildings.types";
import { BuildingsWorkshopView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/BuildingsWorkshop/BuildingsWorkshopView";
import { CraftingBridgeState } from "@logic/modules/camp/crafting/crafting.types";
import { CraftingView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/Crafting/CraftingView";
import { UnitRosterView } from "@screens/VoidCamp/components/UnitRoster/UnitRosterView";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import { AchievementsBridgePayload } from "@logic/modules/shared/achievements/achievements.types";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { useLocalization } from "@ui/shared/useLocalization";
import { NewUnlockWrapper } from "@ui-shared/NewUnlockWrapper";
import { DarkResearchBridgeState } from "@logic/modules/camp/dark-research/dark-research.types";
import { ArtifactsBridgeState } from "@logic/modules/camp/artifacts/artifacts.types";
import { DarkResearchView } from "./DarkResearch/DarkResearchView";
import { ArtifactsView } from "./Artifacts/ArtifactsView";
import "./CampTabPanels.css";

type CampTabPanelsProps = {
  activeTab: Exclude<CampTabKey, "buildings">;
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  mapResourcePreviewCache: MapResourcePreviewCache;
  onSelectMap: (mapId: MapId) => void;
  onSelectMapLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
  moduleWorkshopState: UnitModuleWorkshopBridgeState;
  resourceTotals: ResourceAmountPayload[];
  unitDesignerState: UnitDesignerBridgeState;
  unitAutomationState: UnitAutomationBridgeState;
  maxUnitsOnMap: number;
  buildingsState: BuildingsWorkshopBridgeState;
  craftingState: CraftingBridgeState;
  darkResearchState: DarkResearchBridgeState;
  artifactsState: ArtifactsBridgeState;
  achievementsState: AchievementsBridgePayload;
  newUnlocksState: NewUnlockNotificationBridgeState;
};

export const CampTabPanels: React.FC<CampTabPanelsProps> = ({
  activeTab,
  maps,
  clearedLevelsTotal,
  selectedMap,
  mapResourcePreviewCache,
  onSelectMap,
  onSelectMapLevel,
  onStartMap,
  moduleWorkshopState,
  resourceTotals,
  unitDesignerState,
  unitAutomationState,
  maxUnitsOnMap,
  buildingsState,
  craftingState,
  darkResearchState,
  artifactsState,
  achievementsState,
  newUnlocksState,
}) => {
  const { t } = useLocalization();
  const hasEnemyStrategies = maps.some((map) => {
    if (!map.selectable) {
      return false;
    }
    const config = getMapConfig(map.id);
    return Boolean(config.enemySpawnPoints?.length || config.enemies);
  });
  const moduleTabs: { key: "shop" | "designer" | "roster"; label: string }[] = [
    { key: "shop", label: t("voidCamp.modules.title", "Organ Workshop") },
    { key: "designer", label: t("voidCamp.unitDesigner.title", "Unit Designer") },
    { key: "roster", label: t("voidCamp.tabs.battleRoster", "Battle Roster") },
  ];
  const strongholdTabs: { key: "buildings" | "darkResearch" | "artifacts"; label: string; path: string; hasNew: boolean }[] =
    useMemo(() => {
      const tabs: { key: "buildings" | "darkResearch" | "artifacts"; label: string; path: string; hasNew: boolean }[] = [];

      if (buildingsState.unlocked) {
        tabs.push({
          key: "buildings",
          label: t("voidCamp.tabs.buildings", "Buildings"),
          path: "buildings",
          hasNew: (newUnlocksState.unseenByPrefix.buildings ?? []).length > 0,
        });
      }

      if (darkResearchState.unlocked) {
        tabs.push({
          key: "darkResearch",
          label: t("voidCamp.tabs.darkResearch", "Dark Research"),
          path: "darkResearch",
          hasNew: (newUnlocksState.unseenByPrefix.darkResearch ?? []).length > 0,
        });
      }

      if (artifactsState.unlocked) {
        tabs.push({
          key: "artifacts",
          label: t("voidCamp.tabs.artifacts", "Artifacts"),
          path: "artifacts",
          hasNew: (newUnlocksState.unseenByPrefix.artifacts ?? []).length > 0,
        });
      }

      return tabs;
    }, [
      buildingsState.unlocked,
      darkResearchState.unlocked,
      newUnlocksState.unseenByPrefix.buildings,
      newUnlocksState.unseenByPrefix.darkResearch,
      artifactsState.unlocked,
      newUnlocksState.unseenByPrefix.artifacts,
      t,
    ]);
  const [activeModulesTab, setActiveModulesTab] = useState<"shop" | "designer" | "roster">(
    "shop"
  );
  const [activeStrongholdTab, setActiveStrongholdTab] = useState<"buildings" | "darkResearch" | "artifacts">("buildings");

  useEffect(() => {
    if (!moduleWorkshopState.unlocked) {
      setActiveModulesTab("shop");
    }
  }, [moduleWorkshopState.unlocked]);

  useEffect(() => {
    const available: Array<"buildings" | "darkResearch" | "artifacts"> = [];
    if (buildingsState.unlocked) {
      available.push("buildings");
    }
    if (darkResearchState.unlocked) {
      available.push("darkResearch");
    }
    if (artifactsState.unlocked) {
      available.push("artifacts");
    }

    if (available.length === 0) {
      setActiveStrongholdTab("buildings");
      return;
    }

    if (!available.includes(activeStrongholdTab)) {
      setActiveStrongholdTab(available[0] ?? "buildings");
    }
  }, [activeStrongholdTab, buildingsState.unlocked, darkResearchState.unlocked, artifactsState.unlocked]);

  if (activeTab === "maps") {
    return (
      <MapSelectPanel
        maps={maps}
        clearedLevelsTotal={clearedLevelsTotal}
        selectedMap={selectedMap}
        mapResourcePreviewCache={mapResourcePreviewCache}
        achievements={achievementsState}
        onSelectMap={onSelectMap}
        onSelectLevel={onSelectMapLevel}
        onStartMap={onStartMap}
      />
    );
  }

  if (activeTab === "modules") {
    if (!moduleWorkshopState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">{t("voidCamp.tabs.organsUnavailable", "Organs Unavailable")}</h2>
          <p className="body-md text-muted">
            {t("voidCamp.tabs.organsUnavailableDesc", "Unlock the Chord skill to access organ fabrication and upgrades.")}
          </p>
        </div>
      );
    }

    return (
      <div className="camp-tab-panels__modules">
        <div className="inline-tabs camp-tab-panels__modules-tabs">
          {moduleTabs.map((tab) => {
            const isActive = activeModulesTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={
                  "inline-tabs__button" + (isActive ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveModulesTab(tab.key)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="camp-tab-panels__modules-body">
          {activeModulesTab === "shop" ? (
            <ModulesWorkshopView
              state={moduleWorkshopState}
              resources={resourceTotals}
            />
          ) : activeModulesTab === "designer" ? (
            <UnitDesignerView state={unitDesignerState} resources={resourceTotals} />
          ) : (
            <UnitRosterView
              state={unitDesignerState}
              automation={unitAutomationState}
              hasEnemyStrategies={hasEnemyStrategies}
              maxUnitsOnMap={maxUnitsOnMap}
            />
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "stronghold") {
    if (!buildingsState.unlocked && !darkResearchState.unlocked && !artifactsState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">{t("voidCamp.tabs.strongholdUnavailable", "Stronghold Unavailable")}</h2>
          <p className="body-md text-muted">
            {t("voidCamp.tabs.strongholdUnavailableDesc", "Unlock Construction Guild or Souls Harvest to access Stronghold systems.")}
          </p>
        </div>
      );
    }

    return (
      <div className="camp-tab-panels__modules">
        <div className="inline-tabs camp-tab-panels__modules-tabs">
          {strongholdTabs.map((tab) => {
            const isActive = activeStrongholdTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={
                  "inline-tabs__button" + (isActive ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveStrongholdTab(tab.key)}
              >
                <NewUnlockWrapper path={tab.path} hasNew={tab.hasNew}>
                  {tab.label}
                </NewUnlockWrapper>
              </button>
            );
          })}
        </div>
        <div className="camp-tab-panels__modules-body">
          {activeStrongholdTab === "buildings" ? (
            buildingsState.unlocked ? (
              <BuildingsWorkshopView state={buildingsState} resources={resourceTotals} />
            ) : (
              <div className="camp-tab-panels__modules-locked surface-panel">
                <h2 className="heading-2">{t("voidCamp.tabs.buildingsUnavailable", "Buildings Unavailable")}</h2>
                <p className="body-md text-muted">
                  {t("voidCamp.tabs.buildingsUnavailableDesc", "Unlock the Construction Guild skill to coordinate permanent structures.")}
                </p>
              </div>
            )
          ) : activeStrongholdTab === "darkResearch" ? (
            <DarkResearchView state={darkResearchState} />
          ) : (
            <ArtifactsView state={artifactsState} />
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "crafting") {
    if (!craftingState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">{t("voidCamp.tabs.craftingUnavailable", "Crafting Unavailable")}</h2>
          <p className="body-md text-muted">
            {t("voidCamp.tabs.craftingUnavailableDesc", "Unlock a crafting recipe to begin processing resources into advanced goods.")}
          </p>
        </div>
      );
    }

    return <CraftingView state={craftingState} resources={resourceTotals} />;
  }

  return (
    <div className="camp-tab-panels__skill-tree">
      <SkillTreeView />
    </div>
  );
};
