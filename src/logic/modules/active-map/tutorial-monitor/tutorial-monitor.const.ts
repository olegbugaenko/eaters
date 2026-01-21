import type { TutorialMonitorStatus } from "./tutorial-monitor.types";

export const TUTORIAL_MONITOR_INPUT_BRIDGE_KEY = "tutorial/monitor/input";
export const TUTORIAL_MONITOR_OUTPUT_BRIDGE_KEY = "tutorial/monitor/output";

export const DEFAULT_TUTORIAL_MONITOR_STATUS: TutorialMonitorStatus = Object.freeze({
  stepId: null,
  ready: false,
  version: 0,
});

export const DEFAULT_BRICKS_REQUIRED = 3;

export const TUTORIAL_SANITY_MIN_SUMMON = 2;
export const TUTORIAL_SANITY_MIN_SPELL = 1;
