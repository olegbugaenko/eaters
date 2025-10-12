import { UnitModuleBonusType } from "../../../db/unit-modules-db";
import { formatNumber } from "./number";

const PRECISION: Record<UnitModuleBonusType, { minimumFractionDigits: number; maximumFractionDigits: number }> = {
  multiplier: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  percent: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
};

export const formatUnitModuleBonusValue = (
  type: UnitModuleBonusType,
  value: number
): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return type === "percent" ? "0%" : "x0";
  }
  const options = PRECISION[type] ?? { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (type === "percent") {
    return `${formatNumber(value * 100, options)}%`;
  }
  return `x${formatNumber(value, options)}`;
};
