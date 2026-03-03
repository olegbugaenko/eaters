export interface GraphicsSettings {
  brickHitParticles: boolean;
  brickDestroyParticles: boolean;
}

export type GraphicsSettingKey = keyof GraphicsSettings;

export const GRAPHICS_SETTINGS_STORAGE_KEY = "voidcamp-graphics-settings";

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = Object.freeze({
  brickHitParticles: true,
  brickDestroyParticles: true,
});

export const parseStoredGraphicsSettings = (value: unknown): GraphicsSettings => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
  const record = value as Partial<Record<GraphicsSettingKey, unknown>>;
  return {
    brickHitParticles:
      typeof record.brickHitParticles === "boolean"
        ? record.brickHitParticles
        : DEFAULT_GRAPHICS_SETTINGS.brickHitParticles,
    brickDestroyParticles:
      typeof record.brickDestroyParticles === "boolean"
        ? record.brickDestroyParticles
        : DEFAULT_GRAPHICS_SETTINGS.brickDestroyParticles,
  };
};

export const readStoredGraphicsSettings = (): GraphicsSettings => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(GRAPHICS_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_GRAPHICS_SETTINGS };
    }
    const parsed = JSON.parse(raw) as unknown;
    return parseStoredGraphicsSettings(parsed);
  } catch (error) {
    console.error("Failed to read graphics settings", error);
    return { ...DEFAULT_GRAPHICS_SETTINGS };
  }
};

export const persistGraphicsSettings = (settings: GraphicsSettings): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      GRAPHICS_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        brickHitParticles: Boolean(settings.brickHitParticles),
        brickDestroyParticles: Boolean(settings.brickDestroyParticles),
      })
    );
  } catch (error) {
    console.error("Failed to persist graphics settings", error);
  }
};

export const mergeGraphicsSettings = (
  base: GraphicsSettings,
  patch: Partial<GraphicsSettings>
): GraphicsSettings => ({
  brickHitParticles: patch.brickHitParticles ?? base.brickHitParticles,
  brickDestroyParticles: patch.brickDestroyParticles ?? base.brickDestroyParticles,
});
