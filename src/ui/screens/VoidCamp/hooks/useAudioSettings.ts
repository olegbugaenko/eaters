import { useCallback, useState } from "react";
import {
  AudioSettingKey,
  AudioSettingsPercentages as AudioSettings,
  clampVolumePercentage,
  persistAudioSettings,
  readStoredAudioSettings,
} from "@logic/utils/audioSettings";

export type { AudioSettings };
export type { AudioSettingKey } from "@logic/utils/audioSettings";
export { DEFAULT_AUDIO_SETTINGS } from "@logic/utils/audioSettings";

export const useAudioSettings = () => {
  const [settings, setSettings] = useState<AudioSettings>(() => readStoredAudioSettings());

  const setAudioSetting = useCallback((key: AudioSettingKey, value: number) => {
    setSettings((previous) => {
      const next: AudioSettings = {
        ...previous,
        [key]: clampVolumePercentage(value),
      };
      persistAudioSettings(next);
      return next;
    });
  }, []);

  return {
    settings,
    setAudioSetting,
  } as const;
};
