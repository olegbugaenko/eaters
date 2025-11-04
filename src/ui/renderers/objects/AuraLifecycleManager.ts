import { FILL_TYPES } from "../../../logic/services/SceneObjectManager";
import type { SceneObjectInstance } from "../../../logic/services/SceneObjectManager";
import { clearPetalAuraInstances } from "../primitives/PetalAuraGpuRenderer";
import { clearAllAuraSlots as clearPlayerAuraSlots } from "./PlayerUnitObjectRenderer";

type SceneSyncChanges = {
  added: SceneObjectInstance[];
  updated: SceneObjectInstance[];
  removed: string[];
};

export interface AuraLifecycleManagerCallbacks {
  clearPetalAuras: () => void;
  clearPlayerAuraSlots: () => void;
}

const DEFAULT_CALLBACKS: AuraLifecycleManagerCallbacks = {
  clearPetalAuras: clearPetalAuraInstances,
  clearPlayerAuraSlots,
};

type PlayerUnitLifecycleState = "active" | "pendingRemoval";

export class AuraLifecycleManager {
  private readonly playerUnitStates = new Map<string, PlayerUnitLifecycleState>();
  private activePlayerUnitCount = 0;
  private readonly clearPetalAuras: () => void;
  private readonly clearPlayerAuraSlots: () => void;

  constructor(callbacks: AuraLifecycleManagerCallbacks = DEFAULT_CALLBACKS) {
    this.clearPetalAuras = callbacks.clearPetalAuras;
    this.clearPlayerAuraSlots = callbacks.clearPlayerAuraSlots;
  }

  public bootstrap(objects: readonly SceneObjectInstance[]): void {
    this.playerUnitStates.clear();
    this.activePlayerUnitCount = 0;
    objects.forEach((instance) => {
      if (instance.type === "playerUnit") {
        this.markActive(instance.id);
      }
    });
  }

  public onSceneSync(changes: SceneSyncChanges): void {
    const previouslyTrackedUnits = this.playerUnitStates.size;
    const previouslyHadActiveUnits = this.activePlayerUnitCount > 0;

    changes.removed.forEach((id) => {
      this.forgetUnit(id);
    });

    changes.updated.forEach((instance) => {
      if (instance.type === "playerUnit") {
        if (isPendingRemoval(instance)) {
          this.markPendingRemoval(instance.id);
        } else {
          this.markActive(instance.id);
        }
      } else {
        this.forgetUnit(instance.id);
      }
    });

    const lostAllBeforeAdditions = previouslyHadActiveUnits && this.activePlayerUnitCount === 0;

    changes.added.forEach((instance) => {
      if (instance.type === "playerUnit") {
        this.markActive(instance.id);
      }
    });

    const hasActiveUnits = this.activePlayerUnitCount > 0;

    if (lostAllBeforeAdditions || (!hasActiveUnits && (previouslyHadActiveUnits || previouslyTrackedUnits > 0))) {
      this.clearPlayerAuraSlots();
      this.clearPetalAuras();
    }
  }

  private markActive(id: string): void {
    const previous = this.playerUnitStates.get(id);
    if (previous === "active") {
      return;
    }
    if (previous === "pendingRemoval") {
      this.activePlayerUnitCount += 1;
      this.playerUnitStates.set(id, "active");
      return;
    }
    this.playerUnitStates.set(id, "active");
    this.activePlayerUnitCount += 1;
  }

  private markPendingRemoval(id: string): void {
    const previous = this.playerUnitStates.get(id);
    if (previous === "pendingRemoval") {
      return;
    }
    if (previous === "active") {
      this.activePlayerUnitCount = Math.max(0, this.activePlayerUnitCount - 1);
    }
    this.playerUnitStates.set(id, "pendingRemoval");
  }

  private forgetUnit(id: string): void {
    const previous = this.playerUnitStates.get(id);
    if (!previous) {
      return;
    }
    if (previous === "active") {
      this.activePlayerUnitCount = Math.max(0, this.activePlayerUnitCount - 1);
    }
    this.playerUnitStates.delete(id);
  }
}

const isPendingRemoval = (instance: SceneObjectInstance): boolean => {
  if (instance.type !== "playerUnit") {
    return false;
  }
  const fill = instance.data.fill;
  if (!fill || fill.fillType !== FILL_TYPES.SOLID) {
    return false;
  }
  const color = fill.color;
  if (!color) {
    return false;
  }
  return color.r === 0 && color.g === 0 && color.b === 0 && (color.a ?? 1) === 0;
};
