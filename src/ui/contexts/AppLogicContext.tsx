import { createContext, useContext } from "react";
import { Application } from "../../logic/core/Application";
import { DataBridge } from "../../logic/core/DataBridge";
import { SceneObjectManager } from "../../logic/services/scene-object-manager/SceneObjectManager";

interface AppLogicContextValue {
  app: Application;
  bridge: DataBridge;
  scene: SceneObjectManager;
}

export const AppLogicContext = createContext<AppLogicContextValue | null>(null);

export const useAppLogic = (): AppLogicContextValue => {
  const value = useContext(AppLogicContext);
  if (!value) {
    throw new Error("AppLogicContext is not provided");
  }
  return value;
};
