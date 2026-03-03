import { useCallback, useState } from "react";
import {
  GraphicsSettingKey,
  GraphicsSettings,
  persistGraphicsSettings,
  readStoredGraphicsSettings,
} from "@logic/utils/graphicsSettings";

export type { GraphicsSettings, GraphicsSettingKey };

export const useGraphicsSettings = () => {
  const [settings, setSettings] = useState<GraphicsSettings>(() => readStoredGraphicsSettings());

  const setGraphicsSetting = useCallback((key: GraphicsSettingKey, value: boolean) => {
    setSettings((previous) => {
      const next: GraphicsSettings = {
        ...previous,
        [key]: value,
      };
      persistGraphicsSettings(next);
      return next;
    });
  }, []);

  return {
    settings,
    setGraphicsSetting,
  } as const;
};
