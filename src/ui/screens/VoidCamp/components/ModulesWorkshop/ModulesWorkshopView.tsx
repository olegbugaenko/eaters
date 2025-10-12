import { useCallback, useMemo } from "react";
import { ResourceAmountPayload } from "@logic/modules/ResourcesModule";
import {
  DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  UnitModuleWorkshopBridgeState,
} from "@logic/modules/UnitModuleWorkshopModule";
import { ResourceCostDisplay } from "@shared/ResourceCostDisplay";
import { formatNumber } from "@shared/format/number";
import { formatUnitModuleBonusValue } from "@shared/format/unitModuleBonus";
import { useAppLogic } from "@ui/contexts/AppLogicContext";
import { UnitModuleId } from "@db/unit-modules-db";
import "./ModulesWorkshopView.css";

interface ModulesWorkshopViewProps {
  state?: UnitModuleWorkshopBridgeState;
  resources: ResourceAmountPayload[];
}

const computeMissingCost = (
  cost: Record<string, number> | null,
  totals: Record<string, number>
): Record<string, number> => {
  if (!cost) {
    return {};
  }
  const missing: Record<string, number> = {};
  Object.entries(cost).forEach(([key, amount]) => {
    const current = totals[key] ?? 0;
    const delta = amount - current;
    if (delta > 0) {
      missing[key] = delta;
    }
  });
  return missing;
};

const computeNextBonusValue = (
  base: number,
  perLevel: number,
  currentLevel: number
): number => {
  const nextLevel = currentLevel + 1;
  if (nextLevel <= 0) {
    return 0;
  }
  return base + perLevel * (nextLevel - 1);
};

export const ModulesWorkshopView: React.FC<ModulesWorkshopViewProps> = ({
  state = DEFAULT_UNIT_MODULE_WORKSHOP_STATE,
  resources,
}) => {
  const { app } = useAppLogic();
  const workshop = useMemo(() => app.getUnitModuleWorkshop(), [app]);
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach((entry) => {
      map[entry.id] = entry.amount;
    });
    return map;
  }, [resources]);

  const handleUpgrade = useCallback(
    (id: UnitModuleId) => {
      workshop.tryUpgradeModule(id);
    },
    [workshop]
  );

  if (!state.modules || state.modules.length === 0) {
    return (
      <div className="modules-workshop__empty surface-panel">
        <h2 className="heading-2">Modules</h2>
        <p>No modules are available yet.</p>
      </div>
    );
  }

  return (
    <div className="modules-workshop">
      {state.modules.map((module) => {
        const missing = computeMissingCost(module.nextCost, totals);
        const canAfford = Object.keys(missing).length === 0;
        const buttonLabel = module.level > 0 ? "Upgrade" : "Unlock";
        const currentBonusLabel =
          module.level > 0
            ? formatUnitModuleBonusValue(module.bonusType, module.currentBonusValue)
            : formatUnitModuleBonusValue(
                module.bonusType,
                computeNextBonusValue(module.baseBonusValue, module.bonusPerLevel, 0)
              );
        const nextBonusValue = computeNextBonusValue(
          module.baseBonusValue,
          module.bonusPerLevel,
          module.level
        );

        return (
          <article key={module.id} className="modules-workshop__card surface-panel stack-md">
            <header className="modules-workshop__card-header">
              <div>
                <h2 className="heading-3">{module.name}</h2>
                <p className="body-sm text-muted">Level {module.level}</p>
              </div>
              <button
                type="button"
                className="button button--primary"
                disabled={!module.nextCost || !canAfford}
                onClick={() => handleUpgrade(module.id)}
              >
                {buttonLabel}
              </button>
            </header>
            <p className="body-md modules-workshop__description">{module.description}</p>
            <dl className="modules-workshop__stats">
              <div className="modules-workshop__stat">
                <dt>{module.bonusLabel}</dt>
                <dd>
                  <div className="modules-workshop__stat-value">{currentBonusLabel}</div>
                  <div className="modules-workshop__stat-next">
                    Next level: {formatUnitModuleBonusValue(module.bonusType, nextBonusValue)}
                  </div>
                </dd>
              </div>
              <div className="modules-workshop__stat">
                <dt>Mana cost multiplier</dt>
                <dd>x{formatNumber(module.manaCostMultiplier, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="modules-workshop__stat">
                <dt>Additional sanity cost</dt>
                <dd>+{formatNumber(module.sanityCost, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</dd>
              </div>
            </dl>
            {module.nextCost ? (
              <ResourceCostDisplay cost={module.nextCost} missing={missing} />
            ) : (
              <p className="text-muted body-sm">Unlock the Modules skill to begin fabrication.</p>
            )}
          </article>
        );
      })}
    </div>
  );
};
