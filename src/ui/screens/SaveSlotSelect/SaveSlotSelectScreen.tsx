import { useEffect, useState } from "react";
import { Button } from "../../shared/Button";
import { SaveSlotBackgroundScene } from "./SaveSlotBackgroundScene";
import { VersionHistoryModal } from "@ui/shared/VersionHistoryModal";
import { formatDuration } from "@ui/utils/formatDuration";
import { GAME_VERSIONS } from "@db/version-db";
import { STEAM_WISHLIST_URL } from "@ui/shared/steam";
import { PLAYER_FEEDBACK_FORM_URL } from "@ui/shared/community";
import { useLocalization } from "@ui/shared/useLocalization";
import type { SupportedLanguage } from "@logic/services/localization/localization.types";
import "./SaveSlotSelectScreen.css";

interface SaveSlotViewModel {
  id: string;
  hasSave: boolean;
  timePlayedMs: number | null;
  updatedAt: number | null;
}

interface SaveSlotSelectScreenProps {
  slots: SaveSlotViewModel[];
  onSlotSelect: (slot: string) => void;
  onSlotDelete: (slot: string) => void;
}

const formatLastPlayed = (timestamp: number | null, neverLabel: string): string => {
  if (!timestamp) {
    return neverLabel;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(timestamp);
  } catch (error) {
    console.error("Failed to format date", error);
    return new Date(timestamp).toLocaleString();
  }
};

export const SaveSlotSelectScreen: React.FC<SaveSlotSelectScreenProps> = ({
  slots,
  onSlotSelect,
  onSlotDelete,
}) => {
  const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [isLanguagePopupOpen, setLanguagePopupOpen] = useState(false);
  const {
    language,
    setLanguage,
    availableLanguages,
    hasStoredLanguagePreference,
    t,
  } = useLocalization();
  const currentVersion = GAME_VERSIONS[0] ?? null;

  useEffect(() => {
    setLanguagePopupOpen(!hasStoredLanguagePreference());
  }, []); // Only on mount — do not close when user changes dropdown (Confirm button closes)

  const handleLanguageSelect = (nextLanguage: SupportedLanguage): void => {
    setLanguage(nextLanguage);
    setLanguagePopupOpen(false);
  };

  return (
    <div className="save-slot-screen">
      <div className="save-slot-screen__language-menu surface-card">
        <label className="save-slot-screen__language-label" htmlFor="save-slot-language-select">
          {t("saveSelect.language.label", "Language")}
        </label>
        <select
          id="save-slot-language-select"
          className="save-slot-screen__language-select"
          value={language}
          onChange={(event) => handleLanguageSelect(event.target.value as SupportedLanguage)}
        >
          {availableLanguages.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div className="save-slot-background">
        <SaveSlotBackgroundScene />
      </div>
      <div className="save-slot-screen__content">
        <div className="save-slot-list">
          {slots.map((slot) => {
            const label = slot.hasSave
              ? t("saveSelect.slot.continue", "Continue")
              : t("saveSelect.slot.start", "Start New Game");
            const timePlayed = slot.timePlayedMs ?? 0;
            const formattedTime = slot.hasSave ? formatDuration(timePlayed) : "00:00";
            const lastPlayed = slot.hasSave
              ? formatLastPlayed(slot.updatedAt, t("saveSelect.slot.never", "Never"))
              : null;

            return (
              <article key={slot.id} className="save-slot-card surface-card">
                <header className="save-slot-card__header">
                  <div>
                    <div className="save-slot-card__title">{t("saveSelect.slot.title", "Slot")} {slot.id}</div>
                  </div>
                  {slot.hasSave && (
                    <button
                      type="button"
                      className="save-slot-card__delete"
                      onClick={() => onSlotDelete(slot.id)}
                    >
                      {t("saveSelect.slot.clear", "Clear Slot")}
                    </button>
                  )}
                </header>
                <dl className="save-slot-card__details">
                  <div>
                    <dt>{t("saveSelect.slot.timePlayed", "Time Played")}</dt>
                    <dd>{formattedTime}</dd>
                  </div>
                  <div>
                    <dt>{t("saveSelect.slot.lastPlayed", "Last Played")}</dt>
                    <dd>{lastPlayed ?? t("saveSelect.slot.notAvailable", "—")}</dd>
                  </div>
                </dl>
                <div className="save-slot-card__actions">
                  <Button onClick={() => onSlotSelect(slot.id)}>{label}</Button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="save-slot-screen__links">
          <a
            className="save-slot-screen__wishlist button black-button"
            href={STEAM_WISHLIST_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("saveSelect.links.wishlist", "Wishlist on Steam")}
          </a>
          <a
            className="save-slot-screen__feedback-link"
            href={PLAYER_FEEDBACK_FORM_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("saveSelect.links.feedback", "Share feedback")}
          </a>
        </div>
      </div>
      {isLanguagePopupOpen && (
        <div className="save-slot-screen__language-popup-overlay">
          <div className="save-slot-screen__language-popup surface-card" role="dialog" aria-modal="true">
            <h2 className="save-slot-screen__language-popup-title">
              {t("saveSelect.language.popupTitle", "Choose your language")}
            </h2>
            <p className="save-slot-screen__language-popup-text">
              {t("saveSelect.language.popupText", "Select a language to continue.")}
            </p>
            <select
              className="save-slot-screen__language-popup-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
              autoFocus
            >
              {availableLanguages.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.label}
                </option>
              ))}
            </select>
            <div className="save-slot-screen__language-popup-actions">
              <Button
                onClick={() => {
                  setLanguage(language);
                  setLanguagePopupOpen(false);
                }}
              >
                {t("saveSelect.language.confirm", "Confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {currentVersion && (
        <button
          type="button"
          className="save-slot-screen__version-button"
          onClick={() => setVersionHistoryOpen(true)}
        >
          {currentVersion.displayName}
        </button>
      )}
      <VersionHistoryModal
        isOpen={isVersionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        versions={GAME_VERSIONS}
      />
    </div>
  );
};
