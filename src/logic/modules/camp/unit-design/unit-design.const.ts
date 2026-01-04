import type { UnitDesignerBridgeState } from "./unit-design.types";

export const UNIT_DESIGNER_STATE_BRIDGE_KEY = "unitDesigner/state";

export const MAX_MODULES_PER_UNIT = 3;
export const MAX_ACTIVE_UNITS = 3;

export const DEFAULT_UNIT_DESIGNER_STATE: UnitDesignerBridgeState = Object.freeze({
  units: [],
  availableModules: [],
  maxModules: MAX_MODULES_PER_UNIT,
  activeRoster: [],
  maxActiveUnits: MAX_ACTIVE_UNITS,
  targetingByUnit: {},
});

export const DEFAULT_UNIT_NAME_FALLBACK = "Custom Unit";
export const PERFORATOR_RADIUS = 30;
