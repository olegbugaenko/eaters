export interface AudioSettingsPercentages {
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
}

export type AudioSettingKey = keyof AudioSettingsPercentages;

export interface NormalizedAudioSettings {
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
}

export const AUDIO_SETTINGS_STORAGE_KEY = "voidcamp-audio-settings";

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsPercentages = Object.freeze({
  masterVolume: 100,
  effectsVolume: 100,
  musicVolume: 100,
});

export const clampVolumePercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 100;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 100) {
    return 100;
  }
  return rounded;
};

export const parseStoredAudioSettings = (value: unknown): AudioSettingsPercentages => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
  const record = value as Partial<Record<AudioSettingKey, unknown>>;
  return {
    masterVolume: clampVolumePercentage(
      Number(record.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume),
    ),
    effectsVolume: clampVolumePercentage(
      Number(record.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume),
    ),
    musicVolume: clampVolumePercentage(
      Number(record.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume),
    ),
  };
};

export const readStoredAudioSettings = (): AudioSettingsPercentages => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AUDIO_SETTINGS };
    }
    const parsed = JSON.parse(raw) as unknown;
    return parseStoredAudioSettings(parsed);
  } catch (error) {
    console.error("Failed to read audio settings", error);
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
};

export const persistAudioSettings = (settings: AudioSettingsPercentages): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        masterVolume: clampVolumePercentage(settings.masterVolume),
        effectsVolume: clampVolumePercentage(settings.effectsVolume),
        musicVolume: clampVolumePercentage(settings.musicVolume),
      }),
    );
  } catch (error) {
    console.error("Failed to persist audio settings", error);
  }
};

export const toNormalizedAudioSettings = (
  settings: AudioSettingsPercentages,
): NormalizedAudioSettings => ({
  masterVolume: clampVolumePercentage(settings.masterVolume) / 100,
  effectsVolume: clampVolumePercentage(settings.effectsVolume) / 100,
  musicVolume: clampVolumePercentage(settings.musicVolume) / 100,
});

export const mergeAudioSettings = (
  base: AudioSettingsPercentages,
  patch: Partial<AudioSettingsPercentages>,
): AudioSettingsPercentages => ({
  masterVolume: clampVolumePercentage(
    patch.masterVolume ?? base.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume,
  ),
  effectsVolume: clampVolumePercentage(
    patch.effectsVolume ?? base.effectsVolume ?? DEFAULT_AUDIO_SETTINGS.effectsVolume,
  ),
  musicVolume: clampVolumePercentage(
    patch.musicVolume ?? base.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume,
  ),
});
