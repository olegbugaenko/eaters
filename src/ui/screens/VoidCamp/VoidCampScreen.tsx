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
  MAP_LIST_BRIDGE_KEY,
  MAP_SELECTED_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import { MapListEntry } from "@logic/modules/active-map/map/map.types";
import { TIME_BRIDGE_KEY } from "@logic/modules/shared/time/time.module";
import { RESOURCE_TOTALS_BRIDGE_KEY } from "@logic/modules/shared/resources/resources.module";
import type { ResourceAmountPayload } from "@logic/modules/shared/resources/resources.types";
import {
  CampStatisticsSnapshot,
  DEFAULT_CAMP_STATISTICS,
  STATISTICS_BRIDGE_KEY,
} from "@logic/modules/shared/statistics/statistics.module";
import {
  EVENT_LOG_BRIDGE_KEY,
} from "@logic/modules/shared/event-log/event-log.const";
import type { EventLogEntry } from "@logic/modules/shared/event-log/event-log.types";
import type { StoredSaveData } from "@/core/logic/types";
import { extractTimePlayed } from "@core/logic/provided/services/save-manager/save-manager.helpers";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { useBridgeValue } from "@ui-shared/useBridgeValue";
import { useThrottledBridgeValue } from "@ui-shared/useThrottledBridgeValue";
import { UnitModuleWorkshopBridgeState } from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.types";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/unit-module-workshop/unit-module-workshop.const";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "@logic/services/new-unlock-notification/new-unlock-notification.const";
import type { NewUnlockNotificationBridgeState } from "@logic/services/new-unlock-notification/new-unlock-notification.types";
import { BuildingsWorkshopBridgeState } from "@/logic/modules/camp/buildings/buildings.types";
import {
  BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
  DEFAULT_BUILDINGS_WORKSHOP_STATE,
} from "@/logic/modules/camp/buildings/buildings.const";
import { UnitDesignerBridgeState } from "@logic/modules/camp/unit-design/unit-design.types";
import {
  DEFAULT_UNIT_DESIGNER_STATE,
  UNIT_DESIGNER_STATE_BRIDGE_KEY,
} from "@logic/modules/camp/unit-design/unit-design.const";
import { CraftingBridgeState } from "@logic/modules/camp/crafting/crafting.types";
import {
  CRAFTING_STATE_BRIDGE_KEY,
  DEFAULT_CRAFTING_STATE,
} from "@logic/modules/camp/crafting/crafting.const";
import { UnitAutomationBridgeState } from "@logic/modules/active-map/unit-automation/unit-automation.types";
import {
  DEFAULT_UNIT_AUTOMATION_STATE,
  UNIT_AUTOMATION_STATE_BRIDGE_KEY,
} from "@logic/modules/active-map/unit-automation/unit-automation.const";
import { VersionHistoryModal } from "@ui/shared/VersionHistoryModal";
import { formatDuration } from "@ui/utils/formatDuration";
import { VoidCampTopBar } from "@screens/VoidCamp/components/VoidCamp/VoidCampTopBar";
import {
  SettingsMessage,
  SettingsModal,
  SettingsTab,
} from "@screens/VoidCamp/components/SettingsModal/SettingsModal";
import { useAudioSettings } from "@screens/VoidCamp/hooks/useAudioSettings";
import type { AudioSettingKey, AudioSettings } from "@screens/VoidCamp/hooks/useAudioSettings";
import { clampVolumePercentage } from "@logic/utils/audioSettings";
import { useGraphicsSettings } from "@screens/VoidCamp/hooks/useGraphicsSettings";
import type { GraphicsSettingKey } from "@screens/VoidCamp/hooks/useGraphicsSettings";
import { StatisticsModal } from "@screens/VoidCamp/components/StatisticsModal/StatisticsModal";
import { AchievementsModal } from "@screens/VoidCamp/components/AchievementsModal/AchievementsModal";
import {
  ACHIEVEMENTS_BRIDGE_KEY,
  DEFAULT_ACHIEVEMENTS_STATE,
} from "@logic/modules/shared/achievements/achievements.const";
import type { AchievementsBridgePayload } from "@logic/modules/shared/achievements/achievements.types";

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
  const { uiApi, bridge } = useAppLogic();
  const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isStatisticsOpen, setStatisticsOpen] = useState(false);
  const [isAchievementsOpen, setAchievementsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("game-data");
  const [statusMessage, setStatusMessage] = useState<SettingsMessage | null>(null);
  const { settings: audioSettings, setAudioSetting } = useAudioSettings();
  const { settings: graphicsSettings, setGraphicsSetting } = useGraphicsSettings();
  const currentVersion = GAME_VERSIONS[0] ?? null;
  const timePlayed = useBridgeValue(bridge, TIME_BRIDGE_KEY, 0);
  const maps = useBridgeValue(bridge, MAP_LIST_BRIDGE_KEY, [] as MapListEntry[]);
  const selectedMap = useBridgeValue(bridge, MAP_SELECTED_BRIDGE_KEY, null as MapId | null);
  const clearedLevelsTotal = useBridgeValue(
    bridge,
    MAP_CLEARED_LEVELS_BRIDGE_KEY,
    0
  );
  const resources = useThrottledBridgeValue(
    bridge,
    RESOURCE_TOTALS_BRIDGE_KEY,
    [] as ResourceAmountPayload[],
    250
  );
  const statistics = useBridgeValue(
    bridge,
    STATISTICS_BRIDGE_KEY,
    DEFAULT_CAMP_STATISTICS
  );
  const eventLog = useBridgeValue(bridge, EVENT_LOG_BRIDGE_KEY, [] as EventLogEntry[]);
  const achievementsPayload = useBridgeValue(
    bridge,
    ACHIEVEMENTS_BRIDGE_KEY,
    DEFAULT_ACHIEVEMENTS_STATE
  );
  const newUnlocksState = useBridgeValue(
    bridge,
    NEW_UNLOCKS_BRIDGE_KEY,
    DEFAULT_NEW_UNLOCKS_STATE as NewUnlockNotificationBridgeState
  );
  const moduleWorkshopState = useBridgeValue(
    bridge,
    UNIT_MODULE_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_MODULE_WORKSHOP_STATE
  );
  const buildingsState = useBridgeValue(
    bridge,
    BUILDINGS_WORKSHOP_STATE_BRIDGE_KEY,
    DEFAULT_BUILDINGS_WORKSHOP_STATE
  );
  const unitDesignerState = useBridgeValue(
    bridge,
    UNIT_DESIGNER_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_DESIGNER_STATE
  );
  const unitAutomationState = useBridgeValue(
    bridge,
    UNIT_AUTOMATION_STATE_BRIDGE_KEY,
    DEFAULT_UNIT_AUTOMATION_STATE
  );
  const craftingState = useBridgeValue(
    bridge,
    CRAFTING_STATE_BRIDGE_KEY,
    DEFAULT_CRAFTING_STATE
  );

  useEffect(() => {
    uiApi.audio.applyPercentageSettings(audioSettings);
  }, [
    audioSettings.masterVolume,
    audioSettings.effectsVolume,
    audioSettings.musicVolume,
    uiApi,
  ]);

  const handleAudioSettingChange = useCallback(
    (key: AudioSettingKey, value: number) => {
      const clampedValue = clampVolumePercentage(value);
      const nextSettings: AudioSettings = {
        ...audioSettings,
        [key]: clampedValue,
      };
      setAudioSetting(key, clampedValue);
      uiApi.audio.applyPercentageSettings(nextSettings);
    },
    [audioSettings, setAudioSetting, uiApi],
  );

  const handleGraphicsSettingChange = useCallback(
    (key: GraphicsSettingKey, value: boolean) => {
      setGraphicsSetting(key, value);
    },
    [setGraphicsSetting],
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

  const handleOpenAchievements = useCallback(() => {
    setAchievementsOpen(true);
  }, []);

  const handleCloseAchievements = useCallback(() => {
    setAchievementsOpen(false);
  }, []);

  // Check if there are any unlocked achievements
  const hasUnlockedAchievements = useMemo(
    () => achievementsPayload.achievements.some((achievement) => achievement.level > 0),
    [achievementsPayload.achievements]
  );

  const handleExportSave = useCallback(() => {
    setSettingsTab("game-data");
    if (!uiApi.save.getActiveSlotId()) {
      setStatusMessage({
        tone: "error",
        text: "Select a save slot before exporting progress.",
      });
      return;
    }

    const data = uiApi.save.exportActiveSlot();
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
      const timePlayedMs = extractTimePlayed(data);
      const timePlayedLabel =
        timePlayedMs !== null
          ? `-playtime-${formatDuration(timePlayedMs).replace(":", "m")}s`
          : "";
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `voidcamp-save-${timestamp}${timePlayedLabel}.json`;
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
  }, [uiApi]);

  const handleImportSave = useCallback(
    async (file: File) => {
      setSettingsTab("game-data");
      if (!uiApi.save.getActiveSlotId()) {
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
        uiApi.save.importToActiveSlot(parsed);
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
    [uiApi]
  );

  const handleStartMap = useCallback(
    (mapId: MapId) => {
      const target = maps.find((entry) => entry.id === mapId);
      if (!target) {
        return;
      }
      uiApi.map.selectMap(mapId);
      uiApi.map.restartSelectedMap();
      onStart();
    },
    [maps, onStart, uiApi]
  );

  const handleExit = useCallback(() => {
    setSettingsOpen(false);
    setStatisticsOpen(false);
    setVersionHistoryOpen(false);
    uiApi.app.returnToMainMenu();
    onExit();
  }, [onExit, uiApi]);

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
        sidebar={<ResourceSidebar resources={resources} onStart={onStart} />}
        topBar={
          <VoidCampTopBar
            versionLabel={currentVersion?.displayName}
            onVersionClick={currentVersion ? () => setVersionHistoryOpen(true) : undefined}
            onStatisticsClick={handleOpenStatistics}
            onAchievementsClick={handleOpenAchievements}
            showAchievements={hasUnlockedAchievements}
            onSettingsClick={handleOpenSettings}
            onExitClick={handleExit}
          />
        }
        content={
          <CampContent
            maps={maps}
            clearedLevelsTotal={clearedLevelsTotal}
            selectedMap={selectedMap}
            onSelectMap={(mapId) => uiApi.map.selectMap(mapId)}
            onSelectMapLevel={(mapId, level) => uiApi.map.selectMapLevel(mapId, level)}
            onStartMap={handleStartMap}
            initialTab={initialTab}
            onTabChange={onTabChange}
            resourceTotals={resources}
            moduleWorkshopState={moduleWorkshopState}
            buildingsState={buildingsState}
            unitDesignerState={unitDesignerState}
            unitAutomationState={unitAutomationState}
            craftingState={craftingState}
            achievementsState={achievementsPayload}
            newUnlocksState={newUnlocksState}
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
        graphicsSettings={graphicsSettings}
        onGraphicsSettingChange={handleGraphicsSettingChange}
      />
      <StatisticsModal
        isOpen={isStatisticsOpen}
        onClose={handleCloseStatistics}
        timePlayedMs={timePlayed}
        favoriteMap={favoriteMap}
        statistics={statistics}
        eventLog={eventLog}
      />
      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={handleCloseAchievements}
        achievements={achievementsPayload.achievements}
      />
    </>
  );
};
