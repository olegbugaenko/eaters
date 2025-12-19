import { useCallback, useEffect, useMemo, useState } from "react";
import { VoidCamp } from "@screens/VoidCamp/components/VoidCamp/VoidCamp";
import { ResourceSidebar } from "@screens/VoidCamp/components/ResourceSidebar/ResourceSidebar";
import {
  CampContent,
  CampTabKey,
} from "@screens/VoidCamp/components/CampContent/CampContent";
import { MapId } from "@db/maps-db";
import { GAME_VERSIONS } from "@db/version-db";
import {
  MAP_CLEARED_LEVELS_BRIDGE_KEY,
  MapListEntry,
  MAP_LIST_BRIDGE_KEY,
  MAP_SELECTED_BRIDGE_KEY,
} from "@logic/modules/active-map/MapModule";
import { TIME_BRIDGE_KEY } from "@logic/modules/shared/TestTimeModule";
import { RESOURCE_TOTALS_BRIDGE_KEY, ResourceAmountPayload } from "@logic/modules/shared/ResourcesModule";
import {
  CampStatisticsSnapshot,
  DEFAULT_CAMP_STATISTICS,
  STATISTICS_BRIDGE_KEY,
} from "@logic/modules/shared/StatisticsModule";
import type { StoredSaveData } from "@logic/core/types";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@shared/useBridgeValue";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UnitModuleWorkshopBridgeState,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/UnitModuleWorkshopModule";
import {
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  BuildingsWorkshopBridgeState,
  DEFAULT_BUILDINGS_WORKSHOP_STATE,
} from "@/logic/modules/camp/BuildingsModule";
import {
  DEFAULT_UNIT_DESIGNER_STATE,
  UnitDesignerBridgeState,
  UNIT_DESIGNER_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/UnitDesignModule";
import {
  CraftingBridgeState,
  CRAFTING_STATE_BRIDGE_KEY,
  DEFAULT_CRAFTING_STATE,
} from "@logic/modules/camp/CraftingModule";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UnitAutomationBridgeState,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
} from "@logic/modules/active-map/UnitAutomationModule";
import { VersionHistoryModal } from "@ui/shared/VersionHistoryModal";
import { VoidCampTopBar } from "@screens/VoidCamp/components/VoidCamp/VoidCampTopBar";
import {
  SettingsMessage,
  SettingsModal,
  SettingsTab,
} from "@screens/VoidCamp/components/SettingsModal/SettingsModal";
import { useAudioSettings } from "@screens/VoidCamp/hooks/useAudioSettings";
import type { AudioSettingKey, AudioSettings } from "@screens/VoidCamp/hooks/useAudioSettings";
import { clampVolumePercentage } from "@logic/utils/audioSettings";
import { StatisticsModal } from "@screens/VoidCamp/components/StatisticsModal/StatisticsModal";

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
  const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isStatisticsOpen, setStatisticsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("game-data");
  const [statusMessage, setStatusMessage] = useState<SettingsMessage | null>(null);
  const { settings: audioSettings, setAudioSetting } = useAudioSettings();
  const currentVersion = GAME_VERSIONS[0] ?? null;
  const timePlayed = useBridgeValue<number>(bridge, TIME_BRIDGE_KEY, 0);
  const maps = useBridgeValue<MapListEntry[]>(bridge, MAP_LIST_BRIDGE_KEY, []);
  const selectedMap = useBridgeValue<MapId | null>(bridge, MAP_SELECTED_BRIDGE_KEY, null);
  const clearedLevelsTotal = useBridgeValue<number>(
    bridge,
    MAP_CLEARED_LEVELS_BRIDGE_KEY,
    0
  );
  const resources = useBridgeValue<ResourceAmountPayload[]>(
    bridge,
    RESOURCE_TOTALS_BRIDGE_KEY,
    []
  );
  const statistics = useBridgeValue<CampStatisticsSnapshot>(
    bridge,
    STATISTICS_BRIDGE_KEY,
    DEFAULT_CAMP_STATISTICS
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
  const unitAutomationState = useBridgeValue<UnitAutomationBridgeState>(
    bridge,
    UNIT_AUTOMATION_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_AUTOMATION_STATE
  );
  const craftingState = useBridgeValue<CraftingBridgeState>(
    bridge,
    CRAFTING_STATE_BRIDGE_KEY,
    DEFAULT_CRAFTING_STATE
  );

  useEffect(() => {
    app.applyAudioSettings(audioSettings);
  }, [
    app,
    audioSettings.masterVolume,
    audioSettings.effectsVolume,
    audioSettings.musicVolume,
  ]);

  const handleAudioSettingChange = useCallback(
    (key: AudioSettingKey, value: number) => {
      const clampedValue = clampVolumePercentage(value);
      const nextSettings: AudioSettings = {
        ...audioSettings,
        [key]: clampedValue,
      };
      setAudioSetting(key, clampedValue);
      app.applyAudioSettings(nextSettings);
    },
    [app, audioSettings, setAudioSetting],
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsTab("game-data");
    setStatusMessage(null);
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenStatistics = useCallback(() => {
    setStatisticsOpen(true);
  }, []);

  const handleCloseStatistics = useCallback(() => {
    setStatisticsOpen(false);
  }, []);

  const handleExportSave = useCallback(() => {
    setSettingsTab("game-data");
    if (!app.hasActiveSaveSlot()) {
      setStatusMessage({
        tone: "error",
        text: "Select a save slot before exporting progress.",
      });
      return;
    }

    const data = app.exportActiveSave();
    if (!data) {
      setStatusMessage({
        tone: "error",
        text: "Unable to access save data for export.",
      });
      return;
    }

    let objectUrl: string | null = null;
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `voidcamp-save-${timestamp}.json`;
      anchor.click();
      setStatusMessage({
        tone: "success",
        text: "Save exported successfully.",
      });
    } catch (error) {
      console.error("Failed to export save", error);
      setStatusMessage({
        tone: "error",
        text: "Failed to export save file.",
      });
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }, [app]);

  const handleImportSave = useCallback(
    async (file: File) => {
      setSettingsTab("game-data");
      if (!app.hasActiveSaveSlot()) {
        setStatusMessage({
          tone: "error",
          text: "Select a save slot before importing progress.",
        });
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as StoredSaveData;
        if (!parsed || typeof parsed !== "object" || typeof parsed.modules !== "object") {
          throw new Error("Invalid save structure");
        }
        app.importActiveSave(parsed);
        setStatusMessage({
          tone: "success",
          text: `Imported save from ${file.name}.`,
        });
      } catch (error) {
        console.error("Failed to import save", error);
        setStatusMessage({
          tone: "error",
          text: "Import failed. Ensure the file is a valid save export.",
        });
      }
    },
    [app]
  );

  const handleStartMap = useCallback(
    (mapId: MapId) => {
      const target = maps.find((entry) => entry.id === mapId);
      if (!target) {
        return;
      }
      app.selectMap(mapId);
      app.restartCurrentMap();
      onStart();
    },
    [app, maps, onStart]
  );

  const handleExit = useCallback(() => {
    setSettingsOpen(false);
    setStatisticsOpen(false);
    setVersionHistoryOpen(false);
    app.returnToMainMenu();
    onExit();
  }, [app, onExit]);

  const favoriteMap = useMemo(() => {
    let best: { id: MapId; name: string; attempts: number } | null = null;
    maps.forEach((map) => {
      if (map.attempts <= 0) {
        return;
      }
      if (!best || map.attempts > best.attempts) {
        best = { id: map.id, name: map.name, attempts: map.attempts };
      }
    });
    return best;
  }, [maps]);

  return (
    <>
      <VoidCamp
        sidebar={<ResourceSidebar resources={resources} />}
        topBar={
          <VoidCampTopBar
            versionLabel={currentVersion?.displayName}
            onVersionClick={currentVersion ? () => setVersionHistoryOpen(true) : undefined}
            onStatisticsClick={handleOpenStatistics}
            onSettingsClick={handleOpenSettings}
            onExitClick={handleExit}
          />
        }
        content={
          <CampContent
            maps={maps}
            clearedLevelsTotal={clearedLevelsTotal}
            selectedMap={selectedMap}
            onSelectMap={(mapId) => app.selectMap(mapId)}
            onSelectMapLevel={(mapId, level) => app.selectMapLevel(mapId, level)}
            onStartMap={handleStartMap}
            initialTab={initialTab}
            onTabChange={onTabChange}
            resourceTotals={resources}
            moduleWorkshopState={moduleWorkshopState}
            buildingsState={buildingsState}
            unitDesignerState={unitDesignerState}
            unitAutomationState={unitAutomationState}
            craftingState={craftingState}
          />
        }
      />
      {currentVersion && (
        <VersionHistoryModal
          isOpen={isVersionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          versions={GAME_VERSIONS}
          title="Release notes"
        />
      )}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
        onExport={handleExportSave}
        onImport={handleImportSave}
        statusMessage={statusMessage}
        audioSettings={audioSettings}
        onAudioSettingChange={handleAudioSettingChange}
      />
      <StatisticsModal
        isOpen={isStatisticsOpen}
        onClose={handleCloseStatistics}
        timePlayedMs={timePlayed}
        favoriteMap={favoriteMap}
        statistics={statistics}
      />
    </>
  );
};
