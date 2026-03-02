import { useAppLogic } from "@ui/contexts/AppLogicContext";
import type { ArtifactsBridgeState } from "@logic/modules/camp/artifacts/artifacts.types";
import { useLocalization } from "@ui/shared/useLocalization";
import "./ArtifactsView.css";

type ArtifactsViewProps = {
  state: ArtifactsBridgeState;
};

export const ArtifactsView: React.FC<ArtifactsViewProps> = ({ state }) => {
  const { uiApi } = useAppLogic();
  const { t } = useLocalization();

  return (
    <div className="artifacts-view stack-lg">
      <header>
        <h2 className="heading-2">{t("voidCamp.artifacts.title", "Artifacts")}</h2>
        <p className="body-md text-muted">
          {t(
            "voidCamp.artifacts.description",
            "Collect artifacts and place them into active slots to enable their effects."
          )}
        </p>
      </header>

      <section className="artifacts-view__slots surface-panel stack-sm">
        <h3 className="heading-4">{t("voidCamp.artifacts.activeSlots", "Active slots")}</h3>
        <div className="artifacts-view__slots-grid">
          {state.activeSlots.map((slotId, index) => {
            const equippedArtifact = state.artifacts.find((artifact) => artifact.id === slotId);
            return (
              <div key={index} className="artifacts-view__slot-card">
                <div className="body-sm text-muted">
                  {t("voidCamp.artifacts.slotLabel", "Slot {{index}}").replace("{{index}}", String(index + 1))}
                </div>
                <div className="body-md">
                  {equippedArtifact?.name ?? t("voidCamp.artifacts.emptySlot", "Empty")}
                </div>
                {slotId ? (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => uiApi.artifacts.equipArtifact(index, null)}
                  >
                    {t("voidCamp.artifacts.unequip", "Unequip")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="artifacts-view__inventory surface-panel stack-sm">
        <h3 className="heading-4">{t("voidCamp.artifacts.inventory", "Inventory")}</h3>
        {state.artifacts.filter((artifact) => artifact.owned).length === 0 ? (
          <p className="body-md text-muted">{t("voidCamp.artifacts.empty", "No artifacts discovered yet.")}</p>
        ) : (
          <ul className="artifacts-view__list">
            {state.artifacts
              .filter((artifact) => artifact.owned)
              .map((artifact) => (
                <li key={artifact.id} className="artifacts-view__item">
                  <div>
                    <div className="heading-5">{artifact.name}</div>
                    <p className="body-sm text-muted">{artifact.description}</p>
                  </div>
                  <div className="artifacts-view__actions">
                    {artifact.equippedSlot !== null ? (
                      <span className="body-sm text-muted">
{t("voidCamp.artifacts.equippedIn", "Equipped in slot {{index}}").replace("{{index}}", String(artifact.equippedSlot + 1))}
                      </span>
                    ) : (
                      state.activeSlots.map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          className="button-secondary"
                          onClick={() => uiApi.artifacts.equipArtifact(index, artifact.id)}
                        >
{t("voidCamp.artifacts.equipToSlot", "Equip to slot {{index}}").replace("{{index}}", String(index + 1))}
                        </button>
                      ))
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
};
