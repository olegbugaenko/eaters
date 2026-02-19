import { ChangeEvent, MouseEventHandler, useCallback, useId, useMemo, useRef } from "react";
import { classNames } from "@ui/shared/classNames";
import type { AudioSettingKey, AudioSettings } from "@screens/VoidCamp/hooks/useAudioSettings";
import type {
  GraphicsSettingKey,
  GraphicsSettings,
} from "@screens/VoidCamp/hooks/useGraphicsSettings";
import "./SettingsModal.css";
import type { SupportedLanguage } from "@logic/services/localization/localization.types";

export type SettingsTab = "game-data" | "audio" | "graphics";

export interface SettingsMessage {
  readonly tone: "success" | "error";
  readonly text: string;
}

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly activeTab: SettingsTab;
  readonly onTabChange: (tab: SettingsTab) => void;
  readonly onExport: () => void;
  readonly onImport: (file: File) => Promise<void> | void;
  readonly statusMessage: SettingsMessage | null;
  readonly audioSettings: AudioSettings;
  readonly onAudioSettingChange: (key: AudioSettingKey, value: number) => void;
  readonly graphicsSettings: GraphicsSettings;
  readonly onGraphicsSettingChange: (key: GraphicsSettingKey, value: boolean) => void;
  readonly language: SupportedLanguage;
  readonly onLanguageChange: (language: SupportedLanguage) => void;
  readonly t: (key: string, fallback?: string) => string;
}

const formatPercentage = (value: number): string => `${value}%`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onExport,
  onImport,
  statusMessage,
  audioSettings,
  onAudioSettingChange,
  graphicsSettings,
  onGraphicsSettingChange,
  language,
  onLanguageChange,
  t,
}) => {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const globalVolumeId = useId();
  const effectsVolumeId = useId();
  const musicVolumeId = useId();
  const brickHitParticlesId = useId();
  const brickDestroyParticlesId = useId();
  const explosionStarburstId = useId();

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDialogClick: MouseEventHandler<HTMLDivElement> = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      try {
        await onImport(file);
      } finally {
        event.target.value = "";
      }
    },
    [onImport]
  );

  const tabButtons = useMemo(
    () => [
      { key: "game-data" as SettingsTab, label: t("settings.tabs.gameData", "Game Data") },
      { key: "audio" as SettingsTab, label: t("settings.tabs.audio", "Audio") },
      { key: "graphics" as SettingsTab, label: t("settings.tabs.graphics", "Graphics") },
    ],
    [t]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="settings-modal" onClick={handleBackdropClick}>
      <div
        className="settings-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={handleDialogClick}
      >
        <header className="settings-modal__header">
          <h2 id={titleId} className="settings-modal__title">{t("settings.title", "Settings")}</h2>
          <button type="button" className="settings-modal__close" onClick={onClose}>{t("settings.close", "Close")}</button>
        </header>
        <nav className="settings-modal__tabs" aria-label="Settings tabs">
          <div className="inline-tabs">
            {tabButtons.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={classNames("inline-tabs__button", {
                  "inline-tabs__button--active": activeTab === tab.key,
                })}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="settings-modal__content">
          {activeTab === "game-data" ? (
            <section className="settings-modal__section">
              <h3 className="settings-modal__section-title">{t("settings.sections.gameData.title", "Manage Save Data")}</h3>
              <p className="settings-modal__description">
                {t("settings.sections.gameData.description", "Create a backup of your current ritual or restore progress from a previous export.")}
              </p>
              <div className="settings-modal__slider-group">
                <label htmlFor={globalVolumeId + "-language"}>{t("settings.language.label", "Language")}</label>
                <div className="settings-modal__slider-control">
                  <select
                    id={globalVolumeId + "-language"}
                    value={language}
                    onChange={(event) => onLanguageChange(event.target.value as SupportedLanguage)}
                  >
                    <option value="en">{t("settings.language.english", "English")}</option>
                  </select>
                </div>
              </div>
              <div className="settings-modal__actions">
                <button type="button" className="settings-modal__button" onClick={onExport}>{t("settings.sections.gameData.export", "Export Save")}</button>
                <button
                  type="button"
                  className="settings-modal__button"
                  onClick={handleImportClick}
                >{t("settings.sections.gameData.import", "Import Save")}</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="settings-modal__file-input"
                  onChange={handleImportChange}
                />
              </div>
              {statusMessage && (
                <div
                  className={classNames(
                    "settings-modal__status",
                    statusMessage.tone === "success"
                      ? "settings-modal__status--success"
                      : "settings-modal__status--error"
                  )}
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}
            </section>
          ) : null}
          {activeTab === "audio" ? (
            <section className="settings-modal__section">
              <h3 className="settings-modal__section-title">{t("settings.sections.audio.title", "Audio Levels")}</h3>
              <p className="settings-modal__description">
                {t("settings.sections.audio.description", "Tune the volume of the void to match your surroundings.")}
              </p>
              <div className="settings-modal__sliders">
                <div className="settings-modal__slider-group">
                  <label htmlFor={globalVolumeId}>{t("settings.audio.globalVolume", "Global Volume")}</label>
                  <div className="settings-modal__slider-control">
                    <input
                      id={globalVolumeId}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={audioSettings.masterVolume}
                      onChange={(event) =>
                        onAudioSettingChange("masterVolume", Number(event.target.value))
                      }
                    />
                    <span className="settings-modal__slider-value">
                      {formatPercentage(audioSettings.masterVolume)}
                    </span>
                  </div>
                </div>
                <div className="settings-modal__slider-group">
                  <label htmlFor={effectsVolumeId}>{t("settings.audio.effectsVolume", "Effects Volume")}</label>
                  <div className="settings-modal__slider-control">
                    <input
                      id={effectsVolumeId}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={audioSettings.effectsVolume}
                      onChange={(event) =>
                        onAudioSettingChange("effectsVolume", Number(event.target.value))
                      }
                    />
                    <span className="settings-modal__slider-value">
                      {formatPercentage(audioSettings.effectsVolume)}
                    </span>
                  </div>
                </div>
                <div className="settings-modal__slider-group">
                  <label htmlFor={musicVolumeId}>{t("settings.audio.musicVolume", "Music Volume")}</label>
                  <div className="settings-modal__slider-control">
                    <input
                      id={musicVolumeId}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={audioSettings.musicVolume}
                      onChange={(event) =>
                        onAudioSettingChange("musicVolume", Number(event.target.value))
                      }
                    />
                    <span className="settings-modal__slider-value">
                      {formatPercentage(audioSettings.musicVolume)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
          {activeTab === "graphics" ? (
            <section className="settings-modal__section">
              <h3 className="settings-modal__section-title">{t("settings.sections.graphics.title", "Graphical Effects")}</h3>
              <p className="settings-modal__description">
                {t("settings.sections.graphics.description", "Control the particle effects for brick impacts, destruction, and explosion starbursts.")}
              </p>
              <div className="settings-modal__toggles">
                <label className="settings-modal__toggle" htmlFor={brickHitParticlesId}>
                  <input
                    id={brickHitParticlesId}
                    type="checkbox"
                    checked={graphicsSettings.brickHitParticles}
                    onChange={(event) =>
                      onGraphicsSettingChange("brickHitParticles", event.target.checked)
                    }
                  />
                  {t("settings.graphics.showBrickHitParticles", "Show brick hit particles")}
                </label>
                <label className="settings-modal__toggle" htmlFor={brickDestroyParticlesId}>
                  <input
                    id={brickDestroyParticlesId}
                    type="checkbox"
                    checked={graphicsSettings.brickDestroyParticles}
                    onChange={(event) =>
                      onGraphicsSettingChange("brickDestroyParticles", event.target.checked)
                    }
                  />
                  {t("settings.graphics.showBrickDestroyParticles", "Show brick destruction particles")}
                </label>
                <label className="settings-modal__toggle" htmlFor={explosionStarburstId}>
                  <input
                    id={explosionStarburstId}
                    type="checkbox"
                    checked={graphicsSettings.explosionStarburst}
                    onChange={(event) =>
                      onGraphicsSettingChange("explosionStarburst", event.target.checked)
                    }
                  />
                  {t("settings.graphics.showExplosionStarburst", "Show explosion starburst")}
                </label>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};
