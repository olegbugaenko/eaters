import { useEffect, useState } from "react";
import { MapId } from "@db/maps-db";
import { MapListEntry } from "@logic/modules/MapModule";
import { SkillTreeView } from "@screens/VoidCamp/components/SkillTree/SkillTreeView";
import { ModulesWorkshopView } from "@screens/VoidCamp/components/ModulesWorkshop/ModulesWorkshopView";
import { UnitDesignerView } from "@screens/VoidCamp/components/UnitDesigner/UnitDesignerView";
import { CampTabKey } from "../CampContent";
import { MapSelectPanel } from "./MapSelectPanel/MapSelectPanel";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/UnitModuleWorkshopModule";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import { UnitDesignerBridgeState } from "@logic/modules/UnitDesignModule";
import { BuildingsWorkshopBridgeState } from "@logic/modules/BuildingsModule";
import { BuildingsWorkshopView } from "@screens/VoidCamp/components/BuildingsWorkshop/BuildingsWorkshopView";
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
  unitDesignerState: UnitDesignerBridgeState;
  buildingsState: BuildingsWorkshopBridgeState;
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
  unitDesignerState,
  buildingsState,
}) => {
  const [activeModulesTab, setActiveModulesTab] = useState<"shop" | "designer">("shop");

  useEffect(() => {
    if (!moduleWorkshopState.unlocked) {
      setActiveModulesTab("shop");
    }
  }, [moduleWorkshopState.unlocked]);

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
        <div className="inline-tabs camp-tab-panels__modules-tabs">
          {["shop", "designer"].map((tabKey) => {
            const isActive = activeModulesTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                className={
                  "inline-tabs__button" + (isActive ? " inline-tabs__button--active" : "")
                }
                onClick={() => setActiveModulesTab(tabKey as "shop" | "designer")}
              >
                {tabKey === "shop" ? "Module Shop" : "Unit Designer"}
              </button>
            );
          })}
        </div>
        <div className="camp-tab-panels__modules-body">
          {activeModulesTab === "shop" ? (
            <ModulesWorkshopView state={moduleWorkshopState} resources={resourceTotals} />
          ) : (
            <UnitDesignerView state={unitDesignerState} resources={resourceTotals} />
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

  return (
    <div className="camp-tab-panels__skill-tree">
      <SkillTreeView />
    </div>
  );
};
