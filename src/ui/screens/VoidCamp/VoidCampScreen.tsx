import { useCallback, useEffect, useMemo, useState } from "react";
import { VoidCamp } from "@screens/VoidCamp/components/VoidCamp/VoidCamp";
import { ResourceSidebar } from "@screens/VoidCamp/components/ResourceSidebar/ResourceSidebar";
import {
  CampContent,
  CampTabKey,
} from "@screens/VoidCamp/components/CampContent/CampContent";
import { MapId } from "@/db/maps/maps-db";
import { GAME_VERSIONS } from "@db/version-db";
import {
  MAP_CLEARED_LEVELS_BRIDGE_KEY,
  MAP_LIST_BRIDGE_KEY,
  MAP_RESOURCE_PREVIEW_BRIDGE_KEY,
  MAP_SELECTED_BRIDGE_KEY,
} from "@logic/modules/active-map/map/map.const";
import { MapListEntry, MapResourcePreviewCache } from "@logic/modules/active-map/map/map.types";
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
import {
  NECROMANCER_RESOURCES_BRIDGE_KEY,
} from "@logic/modules/active-map/necromancer/necromancer.const";
import type { NecromancerResourcesPayload } from "@logic/modules/active-map/necromancer/necromancer.types";
import { MAX_UNITS_ON_MAP } from "@logic/modules/active-map/necromancer/necromancer.const";
import { DarkResearchBridgeState } from "@logic/modules/camp/dark-research/dark-research.types";
import {
  DARK_RESEARCH_STATE_BRIDGE_KEY,
  DEFAULT_DARK_RESEARCH_STATE,
} from "@logic/modules/camp/dark-research/dark-research.const";
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
import { STEAM_WISHLIST_URL } from "@ui/shared/steam";
import { PLAYER_FEEDBACK_FORM_URL } from "@ui/shared/community";
import { useLocalization } from "@ui/shared/useLocalization";
import { ARTIFACTS_STATE_BRIDGE_KEY, DEFAULT_ARTIFACTS_STATE } from "@logic/modules/camp/artifacts/artifacts.const";
import type { ArtifactsBridgeState } from "@logic/modules/camp/artifacts/artifacts.types";

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
  const { language, setLanguage, availableLanguages, t } = useLocalization();
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
  const mapResourcePreviewCache = useBridgeValue(
    bridge,
    MAP_RESOURCE_PREVIEW_BRIDGE_KEY,
    {} as MapResourcePreviewCache
  );
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
  const darkResearchState = useBridgeValue(
    bridge,
    DARK_RESEARCH_STATE_BRIDGE_KEY,
    DEFAULT_DARK_RESEARCH_STATE as DarkResearchBridgeState
  );
  const necromancerResources = useBridgeValue(
    bridge,
    NECROMANCER_RESOURCES_BRIDGE_KEY,
    { mana: { current: 0, max: 0 }, sanity: { current: 0, max: 0 }, maxUnits: MAX_UNITS_ON_MAP } as NecromancerResourcesPayload,
  );
  const maxUnitsOnMap = necromancerResources.maxUnits;
  const artifactsState = useBridgeValue(
    bridge,
    ARTIFACTS_STATE_BRIDGE_KEY,
    DEFAULT_ARTIFACTS_STATE as ArtifactsBridgeState
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
        text: t("voidCamp.save.export.noSlot", "Select a save slot before exporting progress."),
      });
      return;
    }

    const data = uiApi.save.exportActiveSlot();
    if (!data) {
      setStatusMessage({
        tone: "error",
        text: t("voidCamp.save.export.noData", "Unable to access save data for export."),
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
        text: t("voidCamp.save.export.success", "Save exported successfully."),
      });
    } catch (error) {
      console.error("Failed to export save", error);
      setStatusMessage({
        tone: "error",
        text: t("voidCamp.save.export.fail", "Failed to export save file."),
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
          text: t("voidCamp.save.import.noSlot", "Select a save slot before importing progress."),
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
          text: t("voidCamp.save.import.fail", "Import failed. Ensure the file is a valid save export."),
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
      const attempts = map.maxAttemptsAcrossLevels;
      if (attempts <= 0) {
        return;
      }
      if (!best || attempts > best.attempts) {
        best = { id: map.id, name: map.name, attempts };
      }
    });
    return best;
  }, [maps]);

  const topTimeMaps = useMemo(
    () =>
      maps
        .filter((map) => (map.totalTimeMs ?? 0) > 0)
        .slice()
        .sort((a, b) => (b.totalTimeMs ?? 0) - (a.totalTimeMs ?? 0))
        .slice(0, 10)
        .map((m) => ({
          id: m.id,
          name: m.name,
          attempts: m.maxAttemptsAcrossLevels,
          totalTimeMs: m.totalTimeMs ?? 0,
        })),
    [maps]
  );

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
            wishlistUrl={STEAM_WISHLIST_URL}
            feedbackUrl={PLAYER_FEEDBACK_FORM_URL}
          />
        }
        content={
          <CampContent
            maps={maps}
            clearedLevelsTotal={clearedLevelsTotal}
            selectedMap={selectedMap}
            mapResourcePreviewCache={mapResourcePreviewCache}
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
            maxUnitsOnMap={maxUnitsOnMap}
            craftingState={craftingState}
            darkResearchState={darkResearchState}
            artifactsState={artifactsState}
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
          title={t("voidCamp.releaseNotes.title", "Release notes")}
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
        language={language}
        onLanguageChange={setLanguage}
        availableLanguages={availableLanguages}
        t={t}
      />
      <StatisticsModal
        isOpen={isStatisticsOpen}
        onClose={handleCloseStatistics}
        timePlayedMs={timePlayed}
        favoriteMap={favoriteMap}
        statistics={statistics}
        eventLog={eventLog}
        topTimeMaps={topTimeMaps}
      />
      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={handleCloseAchievements}
        achievements={achievementsPayload.achievements}
      />
    </>
  );
};
