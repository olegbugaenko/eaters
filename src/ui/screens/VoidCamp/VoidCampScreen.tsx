import { VoidCamp } from "@screens/VoidCamp/components/VoidCamp/VoidCamp";
import { ResourceSidebar } from "@screens/VoidCamp/components/ResourceSidebar/ResourceSidebar";
import {
  CampContent,
  CampTabKey,
} from "@screens/VoidCamp/components/CampContent/CampContent";
import { MapId } from "@db/maps-db";
import { MapListEntry, MAP_LIST_BRIDGE_KEY, MAP_SELECTED_BRIDGE_KEY } from "@logic/modules/MapModule";
import { TIME_BRIDGE_KEY } from "@logic/modules/TestTimeModule";
import { BRICK_COUNT_BRIDGE_KEY } from "@logic/modules/BricksModule";
import { RESOURCE_TOTALS_BRIDGE_KEY, ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@shared/useBridgeValue";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UnitModuleWorkshopBridgeState,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
} from "@logic/modules/UnitModuleWorkshopModule";
import {
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  BuildingsWorkshopBridgeState,
  DEFAULT_BUILDINGS_WORKSHOP_STATE,
} from "@logic/modules/BuildingsModule";
import {
  DEFAULT_UNIT_DESIGNER_STATE,
  UnitDesignerBridgeState,
  UNIT_DESIGNER_STATE_BRIDGE_KEY,
} from "@logic/modules/UnitDesignModule";
import {
  CraftingBridgeState,
  CRAFTING_STATE_BRIDGE_KEY,
  DEFAULT_CRAFTING_STATE,
} from "@logic/modules/CraftingModule";

interface VoidCampScreenProps {
  onStart: () => void;
  onExit: () => void;
  initialTab: CampTabKey;
  onTabChange: (tab: CampTabKey) => void;
}

export const VoidCampScreen: React.FC<VoidCampScreenProps> = ({
  onStart,
  onExit,
  initialTab,
  onTabChange,
}) => {
  const { app, bridge } = useAppLogic();
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const brickCount = useBridgeValue<number>(bridge, BRICK_COUNT_BRIDGE_KEY, 0);
  const maps = useBridgeValue<MapListEntry[]>(bridge, MAP_LIST_BRIDGE_KEY, []);
  const selectedMap = useBridgeValue<MapId | null>(bridge, MAP_SELECTED_BRIDGE_KEY, null);
  const resources = useBridgeValue<ResourceAmountPayload[]>(
    bridge,
    RESOURCE_TOTALS_BRIDGE_KEY,
    []
  );
  const moduleWorkshopState = useBridgeValue<UnitModuleWorkshopBridgeState>(
    bridge,
    UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_MODULE_WORKSHOP_STATE
  );
  const buildingsState = useBridgeValue<BuildingsWorkshopBridgeState>(
    bridge,
    BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_BUILDINGS_WORKSHOP_STATE
  );
  const unitDesignerState = useBridgeValue<UnitDesignerBridgeState>(
    bridge,
    UNIT_DESIGNER_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_DESIGNER_STATE
  );
  const craftingState = useBridgeValue<CraftingBridgeState>(
    bridge,
    CRAFTING_STATE_BRIDGE_KEY,
    DEFAULT_CRAFTING_STATE
  );

  return (
    <VoidCamp
      sidebar={<ResourceSidebar resources={resources} />}
      content={
        <CampContent
          maps={maps}
          selectedMap={selectedMap}
          onSelectMap={(mapId) => app.selectMap(mapId)}
          onSelectMapLevel={(mapId, level) => app.selectMapLevel(mapId, level)}
          onStart={() => {
            if (maps.length === 0 || selectedMap === null) {
              return;
            }
            app.restartCurrentMap();
            onStart();
          }}
          onExit={() => {
            app.returnToMainMenu();
            onExit();
          }}
          timePlayed={timePlayed}
          brickCount={brickCount}
          initialTab={initialTab}
          onTabChange={onTabChange}
          resourceTotals={resources}
          moduleWorkshopState={moduleWorkshopState}
          buildingsState={buildingsState}
          unitDesignerState={unitDesignerState}
          craftingState={craftingState}
        />
      }
    />
  );
};
