import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Application } from "./logic/core/Application";
import { AppLogicContext } from "./ui/contexts/AppLogicContext";
import { SaveSlotSelectScreen } from "./ui/screens/SaveSlotSelect/SaveSlotSelectScreen";
import { VoidCampScreen } from "@screens/VoidCamp/VoidCampScreen";
import { CampTabKey } from "@screens/VoidCamp/components/CampContent/CampContent";
import { SceneScreen } from "./ui/screens/Scene/SceneScreen";

type Screen = "save-select" | "void-camp" | "scene";

const SAVE_SLOTS = ["1", "2", "3"];

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>("save-select");
  const [voidCampTab, setVoidCampTab] = useState<CampTabKey>("maps");

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
              setVoidCampTab("maps");
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
              setVoidCampTab("maps");
              setScreen("save-select");
            }}
            initialTab={voidCampTab}
            onTabChange={setVoidCampTab}
          />
        )}
        {screen === "scene" && (
          <SceneScreen
            onExit={() => {
              app.returnToMainMenu();
              setVoidCampTab("maps");
              setScreen("save-select");
            }}
            onLeaveToMapSelect={() => {
              app.leaveCurrentMap();
              setVoidCampTab("skills");
              setScreen("void-camp");
            }}
          />
        )}
      </div>
    </AppLogicContext.Provider>
  );
}

export default App;
