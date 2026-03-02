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

  private readonly owned = new Set<ArtifactId>();
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
      parsed.owned?.forEach((id) => {
        if (ARTIFACT_IDS.includes(id)) {
          this.owned.add(id);
        }
      });

      parsed.activeSlots?.forEach((id, index) => {
        if (index >= ARTIFACTS_SLOT_COUNT) {
          return;
        }
        if (id === null) {
          this.activeSlots[index] = null;
          return;
        }
        if (ARTIFACT_IDS.includes(id) && this.owned.has(id)) {
          this.activeSlots[index] = id;
        }
      });
    }

    this.refreshUnlocked();
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public save(): unknown {
    return {
      owned: Array.from(this.owned),
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
    if (!ARTIFACT_IDS.includes(artifactId) || this.owned.has(artifactId)) {
      return;
    }
    this.owned.add(artifactId);
    this.newUnlocks.invalidate("artifacts");
    this.pushState();
  }

  public equipArtifact(slotIndex: number, artifactId: ArtifactId | null): void {
    if (slotIndex < 0 || slotIndex >= this.activeSlots.length) {
      return;
    }
    if (artifactId !== null) {
      if (!ARTIFACT_IDS.includes(artifactId) || !this.owned.has(artifactId)) {
        return;
      }
      this.activeSlots = this.activeSlots.map((id) => (id === artifactId ? null : id));
    }
    this.activeSlots[slotIndex] = artifactId;
    this.pushState();
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

  private refreshUnlocked(): boolean {
    const next = this.unlocks.areConditionsMet(ARTIFACTS_UNLOCK_CONDITION);
    const changed = next !== this.unlocked;
    this.unlocked = next;
    return changed;
  }

  private registerUnlockNotifications(): void {
    this.newUnlocks.registerUnlock("artifacts", () => this.unlocked);
    ARTIFACT_IDS.forEach((id) => {
      this.newUnlocks.registerUnlock(`artifacts.${id}`, () => this.owned.has(id));
    });
  }

  private pushState(): void {
    const payload: ArtifactsBridgeState = {
      unlocked: this.unlocked,
      slotCount: ARTIFACTS_SLOT_COUNT,
      activeSlots: [...this.activeSlots],
      artifacts: ARTIFACT_IDS.map((id) => {
        const config = getArtifactConfig(id);
        const equippedSlot = this.activeSlots.findIndex((slotId) => slotId === id);
        return {
          id,
          name: this.localization?.tUi(`voidCamp.artifacts.items.${id}.name`, config.name) ?? config.name,
          description:
            this.localization?.tUi(`voidCamp.artifacts.items.${id}.description`, config.description) ??
            config.description,
          icon: config.icon,
          owned: this.owned.has(id),
          equippedSlot: equippedSlot >= 0 ? equippedSlot : null,
        };
      }),
    };
    DataBridgeHelpers.pushState(this.bridge, ARTIFACTS_STATE_BRIDGE_KEY, payload);
  }
}
