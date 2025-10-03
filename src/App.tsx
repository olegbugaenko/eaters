import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Application } from "./logic/core/Application";
import { AppLogicContext } from "./ui/contexts/AppLogicContext";
import { SaveSlotSelectScreen } from "./ui/screens/SaveSlotSelect/SaveSlotSelectScreen";
import { MapSelectScreen } from "./ui/screens/MapSelect/MapSelectScreen";
import { SceneScreen } from "./ui/screens/Scene/SceneScreen";

type Screen = "save-select" | "map-select" | "scene";

const SAVE_SLOTS = ["1", "2", "3"];

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>("save-select");

  const app = useMemo(() => new Application(), []);

  useEffect(() => {
    app.initialize();
  }, [app]);

  return (
    <AppLogicContext.Provider value={{ app, bridge: app.getBridge() }}>
      <div className="app-root">
        {screen === "save-select" && (
          <SaveSlotSelectScreen
            slots={SAVE_SLOTS}
            onSlotSelect={(slot) => {
              app.selectSlot(slot);
              setScreen("map-select");
            }}
          />
        )}
        {screen === "map-select" && (
          <MapSelectScreen
            onStart={() => {
              setScreen("scene");
            }}
          />
        )}
        {screen === "scene" && <SceneScreen />}
      </div>
    </AppLogicContext.Provider>
  );
}

export default App;
