import { createContext, useContext } from "react";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { UiApiProxy } from "@shared/core/types/ui-api";
import type { LogicUiApiRegistry } from "@core/logic/ui/ui-api.registry";

interface AppLogicContextValue {
  bridge: DataBridge;
  uiApi: UiApiProxy<LogicUiApiRegistry>;
}

export const AppLogicContext = createContext<AppLogicContextValue | null>(null);

export const useAppLogic = (): AppLogicContextValue => {
  const value = useContext(AppLogicContext);
  if (!value) {
    throw new Error("AppLogicContext is not provided");
  }
  return value;
};
