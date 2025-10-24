import { useCallback, useState } from "react";

export interface AudioSettings {
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
}

export type AudioSettingKey = keyof AudioSettings;

const STORAGE_KEY = "voidcamp-audio-settings";

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 100,
  effectsVolume: 100,
  musicVolume: 100,
};

const clampVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

const parseStoredSettings = (value: unknown): AudioSettings => {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  const record = value as Partial<Record<AudioSettingKey, unknown>>;
  return {
    masterVolume: clampVolume(Number(record.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume)),
    effectsVolume: clampVolume(Number(record.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume)),
    musicVolume: clampVolume(Number(record.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume)),
  };
};

const readAudioSettings = (): AudioSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_AUDIO_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_AUDIO_SETTINGS;
    }
    const parsed = JSON.parse(raw) as unknown;
    return parseStoredSettings(parsed);
  } catch (error) {
    console.error("Failed to read audio settings", error);
    return DEFAULT_AUDIO_SETTINGS;
  }
};

const persistAudioSettings = (settings: AudioSettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to persist audio settings", error);
  }
};

export const useAudioSettings = () => {
  const [settings, setSettings] = useState<AudioSettings>(() => readAudioSettings());

  const setAudioSetting = useCallback((key: AudioSettingKey, value: number) => {
    setSettings((previous) => {
      const next: AudioSettings = {
        ...previous,
        [key]: clampVolume(value),
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
