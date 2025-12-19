import { useEffect, useState } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/active-map/MapModule";
import { SkillTreeView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/SkillTree/SkillTreeView";
import { ModulesWorkshopView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/ModulesWorkshop/ModulesWorkshopView";
import { UnitDesignerView } from "@screens/VoidCamp/components/UnitDesigner/UnitDesignerView";
import { CampTabKey } from "../CampContent";
import { MapSelectPanel } from "./MapSelectPanel/MapSelectPanel";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/UnitModuleWorkshopModule";
import { ResourceAmountPayload } from "@logic/modules/shared/ResourcesModule";
import { UnitDesignerBridgeState } from "@logic/modules/camp/UnitDesignModule";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/BuildingsModule";
import { BuildingsWorkshopView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/BuildingsWorkshop/BuildingsWorkshopView";
import { CraftingBridgeState } from "@logic/modules/camp/CraftingModule";
import { CraftingView } from "@/ui/screens/VoidCamp/components/CampContent/TabPanels/Crafting/CraftingView";
import { UnitRosterView } from "@screens/VoidCamp/components/UnitRoster/UnitRosterView";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/UnitAutomationModule";
import "./CampTabPanels.css";

type CampTabPanelsProps = {
  activeTab: CampTabKey;
  maps: MapListEntry[];
  clearedLevelsTotal: number;
  selectedMap: MapId | null;
  onSelectMap: (mapId: MapId) => void;
  onSelectMapLevel: (mapId: MapId, level: number) => void;
  onStartMap: (mapId: MapId) => void;
  moduleWorkshopState: UnitModuleWorkshopBridgeState;
  resourceTotals: ResourceAmountPayload[];
  unitDesignerState: UnitDesignerBridgeState;
  unitAutomationState: UnitAutomationBridgeState;
  buildingsState: BuildingsWorkshopBridgeState;
  craftingState: CraftingBridgeState;
};

export const CampTabPanels: React.FC<CampTabPanelsProps> = ({
  activeTab,
  maps,
  clearedLevelsTotal,
  selectedMap,
  onSelectMap,
  onSelectMapLevel,
  onStartMap,
  moduleWorkshopState,
  resourceTotals,
  unitDesignerState,
  unitAutomationState,
  buildingsState,
  craftingState,
}) => {
  const moduleTabs: { key: "shop" | "designer" | "roster"; label: string }[] = [
    { key: "shop", label: "Organ Workshop" },
    { key: "designer", label: "Unit Designer" },
    { key: "roster", label: "Battle Roster" },
  ];
  const [activeModulesTab, setActiveModulesTab] = useState<"shop" | "designer" | "roster">(
    "shop"
  );

  useEffect(() => {
    if (!moduleWorkshopState.unlocked) {
      setActiveModulesTab("shop");
    }
  }, [moduleWorkshopState.unlocked]);

  if (activeTab === "maps") {
    return (
      <MapSelectPanel
        maps={maps}
        clearedLevelsTotal={clearedLevelsTotal}
        selectedMap={selectedMap}
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
          <h2 className="heading-2">Organs Unavailable</h2>
          <p className="body-md text-muted">
            Unlock the Chord skill to access organ fabrication and upgrades.
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
            <ModulesWorkshopView state={moduleWorkshopState} resources={resourceTotals} />
          ) : activeModulesTab === "designer" ? (
            <UnitDesignerView state={unitDesignerState} resources={resourceTotals} />
          ) : (
            <UnitRosterView state={unitDesignerState} automation={unitAutomationState} />
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "buildings") {
    if (!buildingsState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">Buildings Unavailable</h2>
          <p className="body-md text-muted">
            Unlock the Construction Guild skill to coordinate permanent structures.
          </p>
        </div>
      );
    }

    return <BuildingsWorkshopView state={buildingsState} resources={resourceTotals} />;
  }

  if (activeTab === "crafting") {
    if (!craftingState.unlocked) {
      return (
        <div className="camp-tab-panels__modules-locked surface-panel">
          <h2 className="heading-2">Crafting Unavailable</h2>
          <p className="body-md text-muted">
            Unlock a crafting recipe to begin processing resources into advanced goods.
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
