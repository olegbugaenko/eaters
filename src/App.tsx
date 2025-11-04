import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { Application } from "./logic/core/Application";
import { AppLogicContext } from "./ui/contexts/AppLogicContext";
import { SaveSlotSelectScreen } from "./ui/screens/SaveSlotSelect/SaveSlotSelectScreen";
import { VoidCampScreen } from "@screens/VoidCamp/VoidCampScreen";
import { CampTabKey } from "@screens/VoidCamp/components/CampContent/CampContent";
import { SceneScreen } from "./ui/screens/Scene/SceneScreen";
import { SceneTutorialConfig } from "./ui/screens/Scene/components/overlay/SceneTutorialOverlay";
import { SaveSlotSummary } from "./logic/services/SaveManager";
import { readStoredAudioSettings } from "@logic/utils/audioSettings";

type Screen = "save-select" | "void-camp" | "scene";

const SAVE_SLOTS = ["1", "2", "3"];

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>("save-select");
  const [voidCampTab, setVoidCampTab] = useState<CampTabKey>("maps");
  const [slotSummaries, setSlotSummaries] = useState<Record<string, SaveSlotSummary>>({});
  const [sceneTutorial, setSceneTutorial] = useState<SceneTutorialConfig | null>(null);

  const app = useMemo(() => new Application(), []);

  useEffect(() => {
    app.initialize();
  }, [app]);

  const refreshSlotSummaries = useCallback(() => {
    const saveManager = app.getSaveManager();
    const entries: Record<string, SaveSlotSummary> = {};
    SAVE_SLOTS.forEach((slot) => {
      entries[slot] = saveManager.getSlotSummary(slot);
    });
    setSlotSummaries(entries);
  }, [app]);

  useEffect(() => {
    refreshSlotSummaries();
  }, [refreshSlotSummaries]);

  const handleSlotDelete = useCallback(
    (slot: string) => {
      const confirmed = window.confirm("Clear this save slot? This cannot be undone.");
      if (!confirmed) {
        return;
      }
      const saveManager = app.getSaveManager();
      saveManager.deleteSlot(slot);
      refreshSlotSummaries();
    },
    [app, refreshSlotSummaries]
  );

  const handleSlotSelect = useCallback(
    (slot: string) => {
      const summary = slotSummaries[slot];
      app.selectSlot(slot);
      const storedAudio = readStoredAudioSettings();
      app.applyAudioSettings(storedAudio);

      if (!summary || !summary.hasSave) {
        app.playMapPlaylist();
        app.selectMap("foundations");
        app.selectMapLevel("foundations", 0);
        app.restartCurrentMap();
        setSceneTutorial({ type: "new-player" });
        setScreen("scene");
        return;
      }

      app.playCampPlaylist();
      setSceneTutorial(null);
      setVoidCampTab("maps");
      setScreen("void-camp");
    },
    [app, slotSummaries]
  );

  return (
    <AppLogicContext.Provider
      value={{ app, bridge: app.getBridge(), scene: app.getSceneObjects() }}
    >
      <div className="app-root">
        {screen === "save-select" && (
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
        {screen === "void-camp" && (
          <VoidCampScreen
            onStart={() => {
              app.playMapPlaylist();
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
        {screen === "scene" && (
          <SceneScreen
            tutorial={sceneTutorial}
            onTutorialComplete={() => {
              setSceneTutorial(null);
            }}
            onExit={() => {
              app.returnToMainMenu();
              app.playCampPlaylist();
              setVoidCampTab("maps");
              setScreen("save-select");
              setSceneTutorial(null);
              refreshSlotSummaries();
            }}
            onLeaveToMapSelect={() => {
              app.leaveCurrentMap();
              app.playCampPlaylist();
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
