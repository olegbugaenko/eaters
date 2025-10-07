import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Application } from "./logic/core/Application";
import { AppLogicContext } from "./ui/contexts/AppLogicContext";
import { SaveSlotSelectScreen } from "./ui/screens/SaveSlotSelect/SaveSlotSelectScreen";
import { VoidCampScreen } from "@screens/VoidCamp/VoidCampScreen";
import { SceneScreen } from "./ui/screens/Scene/SceneScreen";

type Screen = "save-select" | "void-camp" | "scene";

const SAVE_SLOTS = ["1", "2", "3"];

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>("save-select");

  const app = useMemo(() => new Application(), []);

  useEffect(() => {
    app.initialize();
  }, [app]);

  return (
    <AppLogicContext.Provider
      value={{ app, bridge: app.getBridge(), scene: app.getSceneObjects() }}
    >
      <div className="app-root">
        {screen === "save-select" && (
          <SaveSlotSelectScreen
            slots={SAVE_SLOTS}
            onSlotSelect={(slot) => {
              app.selectSlot(slot);
              setScreen("void-camp");
            }}
          />
        )}
        {screen === "void-camp" && (
          <VoidCampScreen
            onStart={() => {
              setScreen("scene");
            }}
            onExit={() => {
              setScreen("save-select");
            }}
          />
        )}
        {screen === "scene" && (
          <SceneScreen
            onExit={() => {
              app.returnToMainMenu();
              setScreen("save-select");
            }}
            onLeaveToMapSelect={() => {
              setScreen("void-camp");
            }}
          />
        )}
      </div>
    </AppLogicContext.Provider>
  );
}

export default App;
