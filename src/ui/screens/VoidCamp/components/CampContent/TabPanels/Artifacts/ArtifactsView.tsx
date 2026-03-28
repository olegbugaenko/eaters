import { useCallback, useMemo, useState } from "react";
import { classNames } from "@ui-shared/classNames";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import type {
  ArtifactsBridgeState,
  ArtifactBridgeState,
} from "@logic/modules/camp/artifacts/artifacts.types";
import type { ArtifactId } from "@/db/artifacts-db";
import { useLocalization } from "@ui/shared/useLocalization";
import { ArtifactIcon } from "@ui-shared/icons/ArtifactIcon";
import "./ArtifactsView.css";

const ARTIFACT_ICON_SIZE = 32;

type ArtifactsViewProps = {
  state: ArtifactsBridgeState;
};

export const ArtifactsView: React.FC<ArtifactsViewProps> = ({ state }) => {
  const { uiApi } = useAppLogic();
  const { t } = useLocalization();
  const [selectedId, setSelectedId] = useState<ArtifactId | null>(null);
  const [hoveredId, setHoveredId] = useState<ArtifactId | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragOverInventory, setDragOverInventory] = useState(false);

  const ownedArtifacts = useMemo(
    () => state.artifacts.filter((a) => a.ownedCount > 0),
    [state.artifacts]
  );

  const activeArtifact = useMemo(() => {
    const id = hoveredId ?? selectedId ?? ownedArtifacts[0]?.id ?? null;
    if (!id) return null;
    return state.artifacts.find((a) => a.id === id) ?? null;
  }, [hoveredId, selectedId, ownedArtifacts, state.artifacts]);

  const handleInventoryDragStart = useCallback(
    (e: React.DragEvent, artifactId: ArtifactId) => {
      e.dataTransfer.setData("application/artifact-id", artifactId);
      e.dataTransfer.setData("application/from", "inventory");
      e.dataTransfer.effectAllowed = "move";
      (e.target as HTMLElement).classList.add("artifacts-view__icon--dragging");
    },
    []
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("artifacts-view__icon--dragging");
    setDragOverSlot(null);
    setDragOverInventory(false);
  }, []);

  const handleSlotDragOver = useCallback((e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotIndex);
  }, []);

  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleSlotDrop = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      e.preventDefault();
      setDragOverSlot(null);
      const artifactId = e.dataTransfer.getData("application/artifact-id") as ArtifactId | "";
      if (artifactId) {
        uiApi.artifacts.equipArtifact(slotIndex, artifactId);
      }
    },
    [uiApi.artifacts]
  );

  const handleSlotDragStart = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      const slotId = state.activeSlots[slotIndex];
      if (!slotId) return;
      e.dataTransfer.setData("application/artifact-id", slotId);
      e.dataTransfer.setData("application/from-slot", String(slotIndex));
      e.dataTransfer.setData("application/from", "slot");
      e.dataTransfer.effectAllowed = "move";
      (e.target as HTMLElement).classList.add("artifacts-view__icon--dragging");
    },
    [state.activeSlots]
  );

  const handleInventoryDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverInventory(true);
  }, []);

  const handleInventoryDragLeave = useCallback(() => {
    setDragOverInventory(false);
  }, []);

  const handleInventoryDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverInventory(false);
      const fromSlotStr = e.dataTransfer.getData("application/from-slot");
      if (fromSlotStr) {
        const slotIndex = parseInt(fromSlotStr, 10);
        if (Number.isFinite(slotIndex)) {
          uiApi.artifacts.unequipSlot(slotIndex);
        }
      }
    },
    [uiApi.artifacts]
  );

  const getSlotArtifact = useCallback(
    (slotIndex: number) => {
      const slotId = state.activeSlots[slotIndex];
      if (!slotId) return null;
      return state.artifacts.find((a) => a.id === slotId) ?? null;
    },
    [state.activeSlots, state.artifacts]
  );

  const hasAnyFreeSlot = state.activeSlots.some((id) => id === null);

  const headerContent = (
    <header className="artifacts-view__header">
      <h2 className="heading-2">{t("voidCamp.artifacts.title", "Artifacts")}</h2>
      <p className="body-md text-muted">
        {t(
          "voidCamp.artifacts.description",
          "Collect artifacts and place them into active slots to enable their effects."
        )}
      </p>
    </header>
  );

  if (ownedArtifacts.length === 0) {
    return (
      <div className="artifacts-view master-detail stack-lg">
        {headerContent}
        <div className="artifacts-view__empty surface-panel">
          <p className="body-md text-muted">
            {t("voidCamp.artifacts.empty", "No artifacts discovered yet.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="artifacts-view master-detail stack-lg">
      {headerContent}
      <div className="artifacts-view__content master-detail__content">
        <div className="artifacts-view__main master-detail__list-container">
          <section className="artifacts-view__slots surface-panel stack-sm">
            <h3 className="heading-4">
              {t("voidCamp.artifacts.activeSlots", "Active slots")}
            </h3>
            <div className="artifacts-view__slots-grid">
              {state.activeSlots.map((_, slotIndex) => {
                const equipped = getSlotArtifact(slotIndex);
                const isDropTarget = dragOverSlot === slotIndex;
                return (
                  <div
                    key={slotIndex}
                    className={classNames(
                      "artifacts-view__slot",
                      isDropTarget && "artifacts-view__slot--drop-target"
                    )}
                    onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                    onDragLeave={handleSlotDragLeave}
                    onDrop={(e) => handleSlotDrop(e, slotIndex)}
                  >
                    {equipped ? (
                      <div
                        className="artifacts-view__slot-icon"
                        draggable
                        onDragStart={(e) => handleSlotDragStart(e, slotIndex)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedId(equipped.id)}
                        onMouseEnter={() => setHoveredId(equipped.id)}
                        onMouseLeave={() =>
                          setHoveredId((c) => (c === equipped.id ? null : c))
                        }
                        title={equipped.name}
                      >
                        <ArtifactIcon
                          icon={equipped.icon}
                          name={equipped.name}
                          size={ARTIFACT_ICON_SIZE}
                        />
                      </div>
                    ) : (
                      <div
                        className="artifacts-view__slot-empty"
                        title={t(
                          "voidCamp.artifacts.slotLabel",
                          "Slot {{index}}"
                        ).replace("{{index}}", String(slotIndex + 1))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className={classNames(
              "artifacts-view__inventory surface-panel stack-sm",
              dragOverInventory && "artifacts-view__inventory--drop-target"
            )}
            onDragOver={handleInventoryDragOver}
            onDragLeave={handleInventoryDragLeave}
            onDrop={handleInventoryDrop}
          >
            <h3 className="heading-4">
              {t("voidCamp.artifacts.inventory", "Inventory")}
            </h3>
            <div className="artifacts-view__inventory-grid">
              {ownedArtifacts.map((artifact) => {
                const unequippedCount = artifact.ownedCount - artifact.equippedCount;
                const canDrag = unequippedCount > 0;
                return (
                  <div
                    key={artifact.id}
                    className={classNames(
                      "artifacts-view__icon",
                      (hoveredId === artifact.id || selectedId === artifact.id) &&
                        "artifacts-view__icon--active",
                      !canDrag && "artifacts-view__icon--all-equipped"
                    )}
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => handleInventoryDragStart(e, artifact.id) : undefined}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedId(artifact.id)}
                    onMouseEnter={() => setHoveredId(artifact.id)}
                    onMouseLeave={() =>
                      setHoveredId((c) => (c === artifact.id ? null : c))
                    }
                    title={artifact.name}
                  >
                    <ArtifactIcon
                      icon={artifact.icon}
                      name={artifact.name}
                      size={ARTIFACT_ICON_SIZE}
                    />
                    {artifact.ownedCount > 1 ? (
                      <span className="artifacts-view__icon-badge">
                        {unequippedCount}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="artifacts-view__detail master-detail__detail">
          {activeArtifact ? (
            <ArtifactDetail
              artifact={activeArtifact}
              hasAnyFreeSlot={hasAnyFreeSlot}
              onEquip={() => {
                const freeSlot = state.activeSlots.findIndex((id) => id === null);
                if (freeSlot >= 0) {
                  uiApi.artifacts.equipArtifact(freeSlot, activeArtifact.id);
                }
              }}
              onUnequipOne={() => {
                const slotIndex = state.activeSlots.findIndex(
                  (id) => id === activeArtifact.id
                );
                if (slotIndex >= 0) {
                  uiApi.artifacts.unequipSlot(slotIndex);
                }
              }}
              t={t}
            />
          ) : (
            <div className="master-detail__detail-empty">
              {t("voidCamp.artifacts.hoverHint", "Click or hover an artifact to view details.")}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

type ArtifactDetailProps = {
  artifact: ArtifactBridgeState;
  hasAnyFreeSlot: boolean;
  onEquip: () => void;
  onUnequipOne: () => void;
  t: (key: string, fallback?: string) => string;
};

const ArtifactDetail: React.FC<ArtifactDetailProps> = ({
  artifact,
  hasAnyFreeSlot,
  onEquip,
  onUnequipOne,
  t,
}) => {
  const effects = artifact.effects ?? {};
  const hasEffects =
    effects.sanityDecayMultiplier !== undefined ||
    effects.maxUnitsFlat !== undefined;

  const unequippedCount = artifact.ownedCount - artifact.equippedCount;
  const canEquip = hasAnyFreeSlot && unequippedCount > 0;
  const canUnequip = artifact.equippedCount > 0;

  return (
    <div className="artifacts-view__detail-inner">
      <div className="artifacts-view__detail-header">
        <ArtifactIcon
          icon={artifact.icon}
          name={artifact.name}
          size={ARTIFACT_ICON_SIZE}
          className="artifacts-view__detail-icon"
        />
        <h3 className="heading-3">{artifact.name}</h3>
      </div>
      <p className="artifacts-view__detail-description">{artifact.description}</p>
      <div className="artifacts-view__detail-counts">
        <span className="body-sm text-muted">
          {t("voidCamp.artifacts.owned", "Owned")}: {artifact.ownedCount}
        </span>
        <span className="body-sm text-muted">
          {t("voidCamp.artifacts.equipped", "Equipped")}: {artifact.equippedCount}
        </span>
      </div>
      {hasEffects ? (
        <div className="artifacts-view__detail-effects">
          <h4 className="artifacts-view__detail-effects-title">
            {t("voidCamp.artifacts.effects", "Effects")}
          </h4>
          <ul className="artifacts-view__detail-effects-list">
            {effects.sanityDecayMultiplier !== undefined ? (
              <li
                className={classNames(
                  "artifacts-view__effect",
                  effects.sanityDecayMultiplier > 1 && "artifacts-view__effect--penalty"
                )}
              >
                {t("voidCamp.artifacts.effects.sanityDecay", "Sanity decay")}
                {`: x${effects.sanityDecayMultiplier}`}
              </li>
            ) : null}
            {effects.maxUnitsFlat !== undefined ? (
              <li className="artifacts-view__effect artifacts-view__effect--bonus">
                {t("voidCamp.artifacts.effects.maxUnits", "Max creatures")}:{" "}
                {effects.maxUnitsFlat >= 0 ? "+" : ""}
                {effects.maxUnitsFlat}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <div className="artifacts-view__detail-actions">
        {canEquip ? (
          <button type="button" className="button-secondary" onClick={onEquip}>
            {t("voidCamp.artifacts.equip", "Equip")}
          </button>
        ) : null}
        {canUnequip ? (
          <button type="button" className="button-secondary" onClick={onUnequipOne}>
            {t("voidCamp.artifacts.unequip", "Unequip")}
          </button>
        ) : null}
      </div>
    </div>
  );
};
