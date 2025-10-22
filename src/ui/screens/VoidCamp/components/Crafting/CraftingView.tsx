import { useCallback, useMemo } from "react";
import { CraftingBridgeState } from "@logic/modules/camp/CraftingModule";
import { ResourceAmountPayload } from "@logic/modules/shared/ResourcesModule";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { ResourceIcon } from "@shared/icons/ResourceIcon";
import { formatNumber } from "@shared/format/number";
import { CraftingRecipeId } from "@db/crafting-recipes-db";
import "./CraftingView.css";

interface CraftingViewProps {
  readonly state: CraftingBridgeState;
  readonly resources: ResourceAmountPayload[];
}

const QUICK_BUTTONS: readonly { label: string; type: "set" | "delta" | "max"; value?: number }[] = [
  { label: "0", type: "set", value: 0 },
  { label: "-100", type: "delta", value: -100 },
  { label: "-10", type: "delta", value: -10 },
  { label: "-1", type: "delta", value: -1 },
  { label: "+1", type: "delta", value: 1 },
  { label: "+10", type: "delta", value: 10 },
  { label: "+100", type: "delta", value: 100 },
  { label: "Max", type: "max" },
];

const buildResourceMap = (resources: ResourceAmountPayload[]): Record<string, number> => {
  const map: Record<string, number> = {};
  resources.forEach((entry) => {
    map[entry.id] = entry.amount;
  });
  return map;
};

const computeMissingCost = (
  cost: Record<string, number>,
  totals: Record<string, number>
): Record<string, number> => {
  const missing: Record<string, number> = {};
  Object.entries(cost).forEach(([id, amount]) => {
    if (amount <= 0) {
      return;
    }
    const current = totals[id] ?? 0;
    const delta = amount - current;
    if (delta > 0) {
      missing[id] = delta;
    }
  });
  return missing;
};

const formatCraftTime = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "Instant";
  }
  const seconds = durationMs / 1000;
  if (seconds >= 1) {
    if (Number.isInteger(seconds)) {
      return `${seconds.toFixed(0)}s`;
    }
    return `${seconds.toFixed(1)}s`;
  }
  return `${Math.max(1, Math.round(durationMs))}ms`;
};

export const CraftingView: React.FC<CraftingViewProps> = ({ state, resources }) => {
  const { app } = useAppLogic();
  const crafting = useMemo(() => app.getCrafting(), [app]);
  const totals = useMemo(() => buildResourceMap(resources), [resources]);

  const handleInputChange = useCallback(
    (recipeId: CraftingRecipeId, value: string) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        crafting.setRecipeQueue(recipeId, 0);
        return;
      }
      crafting.setRecipeQueue(recipeId, Math.max(0, Math.floor(parsed)));
    },
    [crafting]
  );

  const handleButtonClick = useCallback(
    (recipeId: CraftingRecipeId, type: "set" | "delta" | "max", value?: number) => {
      switch (type) {
        case "set":
          crafting.setRecipeQueue(recipeId, value ?? 0);
          return;
        case "delta":
          crafting.adjustRecipeQueue(recipeId, value ?? 0);
          return;
        case "max":
          crafting.setRecipeQueueToMax(recipeId);
          return;
        default:
          return;
      }
    },
    [crafting]
  );

  if (!state.recipes || state.recipes.length === 0) {
    return (
      <div className="crafting-view surface-panel stack-lg">
        <header className="crafting-view__header">
          <h2 className="heading-2">Workshop Queue</h2>
          <p className="text-muted">
            No crafting recipes are available yet. Unlock new skills to begin fabricating goods.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="crafting-view surface-panel stack-lg">
      <header className="crafting-view__header">
        <h2 className="heading-2">Workshop Queue</h2>
        <p className="text-muted">Convert stockpiled resources into advanced materials.</p>
      </header>
      <ul className="crafting-view__list">
        {state.recipes.map((recipe) => {
          const missing = computeMissingCost(recipe.cost, totals);
          const progressPercent = Math.round((recipe.progress ?? 0) * 100);
          const statusLabel = (() => {
            if (recipe.inProgress) {
              return `Crafting… ${formatNumber(progressPercent, { maximumFractionDigits: 0 })}%`;
            }
            if (recipe.queue > 0) {
              return recipe.waitingForResources ? "Waiting for resources" : "Ready to craft";
            }
            return "Idle";
          })();

          return (
            <li key={recipe.id} className="crafting-recipe">
              <div className="crafting-recipe__header">
                <ResourceIcon
                  resourceId={recipe.productId}
                  className="crafting-recipe__icon"
                  label={recipe.productName}
                />
                <div>
                  <h3 className="heading-3 crafting-recipe__title">{recipe.productName}</h3>
                  <p className="body-sm text-muted">
                    Produces {formatNumber(recipe.productAmount, { maximumFractionDigits: 0 })}{" "}
                    {recipe.productName.toLowerCase()} per batch · Craft time {formatCraftTime(
                      recipe.durationMs
                    )}
                  </p>
                </div>
              </div>
              <div className="crafting-recipe__cost">
                <ResourceCostDisplay cost={recipe.cost} missing={missing} />
              </div>
              <div className="crafting-recipe__queue">
                <label className="crafting-recipe__queue-label">
                  <span className="text-muted">Queue</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="crafting-recipe__queue-input"
                    value={recipe.queue}
                    onChange={(event) => handleInputChange(recipe.id, event.target.value)}
                  />
                </label>
                <div className="crafting-recipe__quick-buttons">
                  {QUICK_BUTTONS.map((button) => (
                    <button
                      key={button.label}
                      type="button"
                      className="crafting-recipe__quick-button"
                      onClick={() => handleButtonClick(recipe.id, button.type, button.value)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
                <span className="crafting-recipe__queue-max text-muted">
                  Max craftable now: {formatNumber(recipe.maxQueue, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="crafting-recipe__status">
                <span className="crafting-recipe__status-label">{statusLabel}</span>
                <div className="crafting-recipe__progress" aria-hidden={!recipe.inProgress}>
                  <div
                    className="crafting-recipe__progress-bar"
                    style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
