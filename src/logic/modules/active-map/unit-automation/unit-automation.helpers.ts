import type { UnitDesignId } from "../../camp/unit-design/unit-design.types";
import type { AutomationSelectionCandidate } from "./unit-automation.types";
import { AUTOMATION_SELECTION_EPSILON } from "./unit-automation.const";

export const selectNextAutomationTarget = (
  candidates: readonly AutomationSelectionCandidate[],
  skipped: ReadonlySet<UnitDesignId> = new Set<UnitDesignId>()
): UnitDesignId | null => {
  let best: AutomationSelectionCandidate | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let fallback: AutomationSelectionCandidate | null = null;

  for (const candidate of candidates) {
    if (skipped.has(candidate.designId)) {
      continue;
    }
    if (!fallback) {
      fallback = candidate;
    }
    const normalizedSpawned = candidate.activeCount > 0 ? candidate.activeCount : 0;
    const effectiveWeight = candidate.weight > 0 ? candidate.weight : 1;
    const score = normalizedSpawned / effectiveWeight;
    if (!best) {
      best = candidate;
      bestScore = score;
      continue;
    }
    if (score + AUTOMATION_SELECTION_EPSILON < bestScore) {
      best = candidate;
      bestScore = score;
      continue;
    }
    if (Math.abs(score - bestScore) <= AUTOMATION_SELECTION_EPSILON && candidate.order < best.order) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best) {
    return best.designId;
  }
  return fallback ? fallback.designId : null;
};
