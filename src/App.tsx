import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { Application } from "@/core/logic/Application";
import { AppLogicContext } from "./ui/contexts/AppLogicContext";
import { SaveSlotSelectScreen } from "./ui/screens/SaveSlotSelect/SaveSlotSelectScreen";
import { VoidCampScreen } from "@screens/VoidCamp/VoidCampScreen";
import { CampTabKey } from "@screens/VoidCamp/components/CampContent/CampContent";
import { SceneScreen } from "./ui/screens/Scene/SceneScreen";
import { StressTestScreen } from "./ui/screens/StressTest/StressTestScreen";
import { SceneTutorialConfig } from "./ui/screens/Scene/components/overlay/SceneTutorialOverlay";
import { SaveSlotSummary } from "@core/logic/provided/services/save-manager/SaveManager";
import { readStoredAudioSettings } from "@logic/utils/audioSettings";
import { isStressTestBuild } from "@shared/helpers/stresstest.helper";

type Screen = "save-select" | "void-camp" | "scene";

const SAVE_SLOTS = ["1", "2", "3"];

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>("save-select");
  const [voidCampTab, setVoidCampTab] = useState<CampTabKey>("maps");
  const [slotSummaries, setSlotSummaries] = useState<Record<string, SaveSlotSummary>>({});
  const [sceneTutorial, setSceneTutorial] = useState<SceneTutorialConfig | null>(null);
  const isStressTest = useMemo(() => isStressTestBuild(), []);

  const app = useMemo(() => new Application(), []);
  const uiApi = app.uiApi;

  useEffect(() => {
    if (!isStressTest) {
      app.initialize();
    }
  }, [app, isStressTest]);

  const refreshSlotSummaries = useCallback(() => {
    const entries: Record<string, SaveSlotSummary> = {};
    SAVE_SLOTS.forEach((slot) => {
      entries[slot] = uiApi.save.getSlotSummary(slot);
    });
    setSlotSummaries(entries);
  }, [uiApi]);

  useEffect(() => {
    if (!isStressTest) {
      refreshSlotSummaries();
    }
  }, [isStressTest, refreshSlotSummaries]);

  const handleSlotDelete = useCallback(
    (slot: string) => {
      const confirmed = window.confirm("Clear this save slot? This cannot be undone.");
      if (!confirmed) {
        return;
      }
      uiApi.save.deleteSlot(slot);
      refreshSlotSummaries();
    },
    [refreshSlotSummaries, uiApi]
  );

  const handleSlotSelect = useCallback(
    (slot: string) => {
      const summary = slotSummaries[slot];
      uiApi.app.selectSlot(slot);
      const storedAudio = readStoredAudioSettings();
      uiApi.audio.applyPercentageSettings(storedAudio);

      if (!summary || !summary.hasSave) {
        uiApi.audio.playPlaylist("map");
        uiApi.map.selectMap("foundations");
        uiApi.map.selectMapLevel("foundations", 0);
        uiApi.map.restartSelectedMap();
        setSceneTutorial({ type: "new-player" });
        setScreen("scene");
        return;
      }

      uiApi.audio.playPlaylist("camp");
      setSceneTutorial(null);
      setVoidCampTab("maps");
      setScreen("void-camp");
    },
    [slotSummaries, uiApi]
  );

  const appLogicValue = useMemo(
    () => ({ uiApi: app.uiApi, bridge: app.services.bridge }),
    [app.services.bridge, app.uiApi]
  );

  return (
    <AppLogicContext.Provider value={appLogicValue}>
      <div className="app-root">
        {isStressTest && <StressTestScreen />}
        {!isStressTest && screen === "save-select" && (
          <SaveSlotSelectScreen
            slots={SAVE_SLOTS.map((slot) => ({
              id: slot,
              hasSave: slotSummaries[slot]?.hasSave ?? false,
              timePlayedMs: slotSummaries[slot]?.timePlayedMs ?? null,
              updatedAt: slotSummaries[slot]?.updatedAt ?? null,
            }))}
            onSlotSelect={handleSlotSelect}
            onSlotDelete={handleSlotDelete}
          />
        )}
        {!isStressTest && screen === "void-camp" && (
          <VoidCampScreen
            onStart={() => {
              uiApi.audio.playPlaylist("map");
              setScreen("scene");
            }}
            onExit={() => {
              setVoidCampTab("maps");
              setScreen("save-select");
              refreshSlotSummaries();
            }}
            initialTab={voidCampTab}
            onTabChange={setVoidCampTab}
          />
        )}
        {!isStressTest && screen === "scene" && (
          <SceneScreen
            tutorial={sceneTutorial}
            onTutorialComplete={() => {
              setSceneTutorial(null);
            }}
            onExit={() => {
              uiApi.app.returnToMainMenu();
              uiApi.audio.playPlaylist("camp");
              setVoidCampTab("maps");
              setScreen("save-select");
              setSceneTutorial(null);
              refreshSlotSummaries();
            }}
            onLeaveToMapSelect={() => {
              uiApi.map.leaveCurrentMap();
              uiApi.audio.playPlaylist("camp");
              uiApi.gameLoop.start(); // Ensure game loop runs in camp
              setVoidCampTab("skills");
              setScreen("void-camp");
              setSceneTutorial(null);
              refreshSlotSummaries();
            }}
          />
        )}
      </div>
    </AppLogicContext.Provider>
  );
}

export default App;
