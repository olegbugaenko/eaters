import { createContext, useContext } from "react";
import { Application } from "../../logic/core/Application";
import { DataBridge } from "../../logic/core/DataBridge";

interface AppLogicContextValue {
  app: Application;
  bridge: DataBridge;
}

export const AppLogicContext = createContext<AppLogicContextValue | null>(null);

export const useAppLogic = (): AppLogicContextValue => {
  const value = useContext(AppLogicContext);
  if (!value) {
    throw new Error("AppLogicContext is not provided");
  }
  return value;
};
