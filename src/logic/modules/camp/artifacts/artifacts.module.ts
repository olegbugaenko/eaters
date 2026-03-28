import { GameModule } from "@core/logic/types";
import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import { ARTIFACT_IDS, ArtifactId, getArtifactConfig } from "@/db/artifacts-db";
import { ARTIFACTS_SLOT_COUNT, ARTIFACTS_STATE_BRIDGE_KEY, DEFAULT_ARTIFACTS_STATE } from "./artifacts.const";
import type {
  ArtifactsBridgeState,
  ArtifactsModuleOptions,
  ArtifactsRuntimeModifiers,
  ArtifactsSaveData,
} from "./artifacts.types";

const ARTIFACTS_UNLOCK_CONDITION = [{ type: "map" as const, id: "greatOctopus" as const, level: 1 }];

export class ArtifactsModule implements GameModule {
  public readonly id = "artifacts";

  private readonly bridge;
  private readonly unlocks;
  private readonly newUnlocks;
  private readonly localization;

  private readonly owned = new Map<ArtifactId, number>();
  private activeSlots: Array<ArtifactId | null> = Array.from({ length: ARTIFACTS_SLOT_COUNT }, () => null);
  private unlocked = false;

  constructor(options: ArtifactsModuleOptions) {
    this.bridge = options.bridge;
    this.unlocks = options.unlocks;
    this.newUnlocks = options.newUnlocks;
    this.localization = options.localization ?? null;
  }

  public initialize(): void {
    this.registerUnlockNotifications();
    this.refreshUnlocked();
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public reset(): void {
    this.owned.clear();
    this.activeSlots = Array.from({ length: ARTIFACTS_SLOT_COUNT }, () => null);
    this.refreshUnlocked();
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public load(data: unknown | undefined): void {
    this.owned.clear();
    this.activeSlots = Array.from({ length: ARTIFACTS_SLOT_COUNT }, () => null);

    if (typeof data === "object" && data !== null) {
      const parsed = data as ArtifactsSaveData;

      if (parsed.owned) {
        if (Array.isArray(parsed.owned)) {
          // Legacy format: ArtifactId[] — each entry counts as 1
          parsed.owned.forEach((id) => {
            if (ARTIFACT_IDS.includes(id as ArtifactId)) {
              this.owned.set(id as ArtifactId, (this.owned.get(id as ArtifactId) ?? 0) + 1);
            }
          });
        } else {
          // New format: Record<ArtifactId, number>
          Object.entries(parsed.owned).forEach(([id, count]) => {
            if (ARTIFACT_IDS.includes(id as ArtifactId) && typeof count === "number" && count > 0) {
              this.owned.set(id as ArtifactId, Math.max(count, 0));
            }
          });
        }
      }

      parsed.activeSlots?.forEach((id, index) => {
        if (index >= ARTIFACTS_SLOT_COUNT) {
          return;
        }
        if (id === null) {
          this.activeSlots[index] = null;
          return;
        }
        if (ARTIFACT_IDS.includes(id) && (this.owned.get(id) ?? 0) > 0) {
          this.activeSlots[index] = id;
        }
      });

      // Validate: equipped count must not exceed owned count
      this.clampEquippedToOwned();
    }

    this.refreshUnlocked();
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public save(): unknown {
    const ownedRecord: Record<string, number> = {};
    this.owned.forEach((count, id) => {
      if (count > 0) {
        ownedRecord[id] = count;
      }
    });
    return {
      owned: ownedRecord,
      activeSlots: this.activeSlots,
    } satisfies ArtifactsSaveData;
  }

  public tick(): void {
    const changed = this.refreshUnlocked();
    if (changed) {
      this.newUnlocks.invalidate("artifacts");
      this.pushState();
    }
  }

  public grantArtifact(artifactId: ArtifactId): void {
    if (!ARTIFACT_IDS.includes(artifactId)) {
      return;
    }
    this.owned.set(artifactId, (this.owned.get(artifactId) ?? 0) + 1);
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public equipArtifact(slotIndex: number, artifactId: ArtifactId | null): void {
    if (slotIndex < 0 || slotIndex >= this.activeSlots.length) {
      return;
    }
    if (artifactId !== null) {
      if (!ARTIFACT_IDS.includes(artifactId)) {
        return;
      }
      const totalOwned = this.owned.get(artifactId) ?? 0;
      if (totalOwned <= 0) {
        return;
      }
      const equippedCount = this.activeSlots.filter((id) => id === artifactId).length;
      // If we're replacing the same type in this slot, it doesn't consume an extra copy
      const alreadyInThisSlot = this.activeSlots[slotIndex] === artifactId;
      if (!alreadyInThisSlot && equippedCount >= totalOwned) {
        return;
      }
    }
    this.activeSlots[slotIndex] = artifactId;
    this.pushState();
  }

  public unequipSlot(slotIndex: number): void {
    this.equipArtifact(slotIndex, null);
  }

  public getModifiers(): ArtifactsRuntimeModifiers {
    return this.activeSlots.reduce<ArtifactsRuntimeModifiers>(
      (acc, id) => {
        if (!id) {
          return acc;
        }
        const config = getArtifactConfig(id);
        const sanityDecayMultiplier = config.effects.sanityDecayMultiplier ?? 1;
        const maxUnitsFlat = config.effects.maxUnitsFlat ?? 0;
        return {
          sanityDecayMultiplier: acc.sanityDecayMultiplier * Math.max(sanityDecayMultiplier, 0),
          maxUnitsFlat: acc.maxUnitsFlat + Math.max(maxUnitsFlat, 0),
        };
      },
      { sanityDecayMultiplier: 1, maxUnitsFlat: 0 }
    );
  }

  private clampEquippedToOwned(): void {
    const equippedCounts = new Map<ArtifactId, number>();
    for (let i = 0; i < this.activeSlots.length; i += 1) {
      const id = this.activeSlots[i];
      if (!id) continue;
      const current = equippedCounts.get(id) ?? 0;
      const maxOwned = this.owned.get(id) ?? 0;
      if (current >= maxOwned) {
        this.activeSlots[i] = null;
      } else {
        equippedCounts.set(id, current + 1);
      }
    }
  }

  private refreshUnlocked(): boolean {
    const next = this.unlocks.areConditionsMet(ARTIFACTS_UNLOCK_CONDITION);
    const changed = next !== this.unlocked;
    this.unlocked = next;
    return changed;
  }

  private registerUnlockNotifications(): void {
    this.newUnlocks.registerUnlock("artifacts", () => this.unlocked);
    ARTIFACT_IDS.forEach((id) => {
      this.newUnlocks.registerUnlock(`artifacts.${id}`, () => (this.owned.get(id) ?? 0) > 0);
    });
  }

  private pushState(): void {
    const payload: ArtifactsBridgeState = {
      unlocked: this.unlocked,
      slotCount: ARTIFACTS_SLOT_COUNT,
      activeSlots: [...this.activeSlots],
      artifacts: ARTIFACT_IDS.map((id) => {
        const config = getArtifactConfig(id);
        const ownedCount = this.owned.get(id) ?? 0;
        const equippedCount = this.activeSlots.filter((slotId) => slotId === id).length;
        return {
          id,
          name: this.localization?.tUi(`voidCamp.artifacts.items.${id}.name`, config.name) ?? config.name,
          description:
            this.localization?.tUi(`voidCamp.artifacts.items.${id}.description`, config.description) ??
            config.description,
          icon: config.icon,
          ownedCount,
          equippedCount,
          effects: { ...config.effects },
        };
      }),
    };
    DataBridgeHelpers.pushState(this.bridge, ARTIFACTS_STATE_BRIDGE_KEY, payload);
  }
}
