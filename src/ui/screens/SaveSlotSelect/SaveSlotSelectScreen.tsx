import { useState } from "react";
import { Button } from "../../shared/Button";
import { SaveSlotBackgroundScene } from "./SaveSlotBackgroundScene";
import { VersionHistoryModal } from "@ui/shared/VersionHistoryModal";
import { formatDuration } from "@ui/utils/formatDuration";
import { GAME_VERSIONS } from "@db/version-db";
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

const formatLastPlayed = (timestamp: number | null): string => {
  if (!timestamp) {
    return "Never";
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
  const currentVersion = GAME_VERSIONS[0] ?? null;

  return (
    <div className="save-slot-screen">
      <div className="save-slot-background">
        <SaveSlotBackgroundScene />
      </div>
      <div className="save-slot-screen__content">
        <div className="save-slot-list">
          {slots.map((slot) => {
            const label = slot.hasSave ? "Continue" : "Start New Game";
            const timePlayed = slot.timePlayedMs ?? 0;
            const formattedTime = slot.hasSave ? formatDuration(timePlayed) : "00:00";
            const statusText = slot.hasSave ? "Corruption in progress" : "Empty vessel";
            const lastPlayed = slot.hasSave ? formatLastPlayed(slot.updatedAt) : null;

            return (
              <article key={slot.id} className="save-slot-card surface-card">
                <header className="save-slot-card__header">
                  <div>
                    <div className="save-slot-card__title">Slot {slot.id}</div>
                  </div>
                  {slot.hasSave && (
                    <button
                      type="button"
                      className="save-slot-card__delete"
                      onClick={() => onSlotDelete(slot.id)}
                    >
                      Clear Slot
                    </button>
                  )}
                </header>
                <dl className="save-slot-card__details">
                  <div>
                    <dt>Time Played</dt>
                    <dd>{formattedTime}</dd>
                  </div>
                  <div>
                    <dt>Last Played</dt>
                    <dd>{lastPlayed ?? "—"}</dd>
                  </div>
                </dl>
                <div className="save-slot-card__actions">
                  <Button onClick={() => onSlotSelect(slot.id)}>{label}</Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
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
