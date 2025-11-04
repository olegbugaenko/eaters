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

export class AuraLifecycleManager {
  private readonly playerUnitIds = new Set<string>();
  private hasPlayerUnits = false;
  private readonly clearPetalAuras: () => void;
  private readonly clearPlayerAuraSlots: () => void;

  constructor(callbacks: AuraLifecycleManagerCallbacks = DEFAULT_CALLBACKS) {
    this.clearPetalAuras = callbacks.clearPetalAuras;
    this.clearPlayerAuraSlots = callbacks.clearPlayerAuraSlots;
  }

  public bootstrap(objects: readonly SceneObjectInstance[]): void {
    this.playerUnitIds.clear();
    objects.forEach((instance) => {
      if (instance.type === "playerUnit") {
        this.playerUnitIds.add(instance.id);
      }
    });
    this.hasPlayerUnits = this.playerUnitIds.size > 0;
  }

  public onSceneSync(changes: SceneSyncChanges): void {
    const previouslyHadPlayerUnits = this.hasPlayerUnits;

    changes.removed.forEach((id) => {
      this.playerUnitIds.delete(id);
    });

    changes.updated.forEach((instance) => {
      if (instance.type === "playerUnit") {
        this.playerUnitIds.add(instance.id);
      } else {
        this.playerUnitIds.delete(instance.id);
      }
    });

    changes.added.forEach((instance) => {
      if (instance.type === "playerUnit") {
        this.playerUnitIds.add(instance.id);
      }
    });

    this.hasPlayerUnits = this.playerUnitIds.size > 0;

    if (previouslyHadPlayerUnits && !this.hasPlayerUnits) {
      this.clearPlayerAuraSlots();
      this.clearPetalAuras();
    }
  }
}
