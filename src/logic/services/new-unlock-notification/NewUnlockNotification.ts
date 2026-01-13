import { DataBridgeHelpers } from "@/core/logic/ui/DataBridgeHelpers";
import type { DataBridge } from "@/core/logic/ui/DataBridge";
import type { GameModule } from "@/core/logic/types";
import {
  DEFAULT_NEW_UNLOCKS_STATE,
  NEW_UNLOCKS_BRIDGE_KEY,
} from "./new-unlock-notification.const";
import type {
  NewUnlockNotificationBridgeState,
  NewUnlockNotificationOptions,
  NewUnlockNotificationRegistration,
  NewUnlockNotificationSaveData,
  UnlockCheck,
} from "./new-unlock-notification.types";

type UnlockEntry = {
  path: string;
  isUnlocked: boolean;
  isViewed: boolean;
  check: UnlockCheck;
};

export class NewUnlockNotificationService implements GameModule {
  public readonly id = "newUnlocks";

  private readonly bridge: DataBridge;
  private readonly entries = new Map<string, UnlockEntry>();
  private readonly pathsByPrefix = new Map<string, Set<string>>();
  private readonly registeredPaths: string[] = [];
  private viewedPaths = new Set<string>();
  private lastSnapshotHash: string | null = null;

  constructor(options: NewUnlockNotificationOptions) {
    this.bridge = options.bridge;
  }

  public initialize(): void {
    this.pushSnapshot(DEFAULT_NEW_UNLOCKS_STATE);
  }

  public reset(): void {
    this.viewedPaths.clear();
    this.entries.forEach((entry) => {
      entry.isUnlocked = false;
      entry.isViewed = false;
    });
    this.pushSnapshot(DEFAULT_NEW_UNLOCKS_STATE);
  }

  public load(data: unknown | undefined): void {
    const parsed = data as NewUnlockNotificationSaveData | undefined;
    this.viewedPaths = new Set(parsed?.viewed ?? []);
    this.entries.forEach((entry) => {
      entry.isViewed = this.viewedPaths.has(entry.path);
    });
    this.pushSnapshot(this.buildSnapshot());
  }

  public save(): unknown {
    if (this.viewedPaths.size === 0) {
      return {} satisfies NewUnlockNotificationSaveData;
    }
    return { viewed: Array.from(this.viewedPaths) } satisfies NewUnlockNotificationSaveData;
  }

  public tick(_deltaMs: number): void {
    // State updates are event-driven via invalidate/markViewed.
  }

  public registerUnlock(path: string, isUnlocked: UnlockCheck): void {
    const normalized = this.normalizePath(path);
    if (!normalized || this.entries.has(normalized)) {
      return;
    }
    const entry: UnlockEntry = {
      path: normalized,
      isUnlocked: false,
      isViewed: this.viewedPaths.has(normalized),
      check: isUnlocked,
    };
    this.entries.set(normalized, entry);
    this.registeredPaths.push(normalized);
    this.registerPrefixes(normalized);
    this.invalidate(normalized);
  }

  public registerUnlocks(registrations: readonly NewUnlockNotificationRegistration[]): void {
    registrations.forEach((registration) => {
      this.registerUnlock(registration.path, registration.isUnlocked);
    });
  }

  public markViewed(path: string): void {
    const normalized = this.normalizePath(path);
    if (!normalized) {
      return;
    }
    const entry = this.entries.get(normalized);
    if (!entry || !entry.isUnlocked || entry.isViewed) {
      return;
    }
    entry.isViewed = true;
    this.viewedPaths.add(normalized);
    this.pushSnapshot(this.buildSnapshot());
  }

  public invalidate(prefix?: string): void {
    const targets = this.resolveTargets(prefix);
    if (!targets) {
      return;
    }

    let changed = false;
    targets.forEach((path) => {
      const entry = this.entries.get(path);
      if (!entry || entry.isUnlocked) {
        return;
      }
      const unlockedNow = entry.check();
      if (unlockedNow !== entry.isUnlocked) {
        entry.isUnlocked = unlockedNow;
        entry.isViewed = unlockedNow && this.viewedPaths.has(entry.path);
        changed = true;
      }
    });

    if (changed) {
      this.pushSnapshot(this.buildSnapshot());
    }
  }

  private resolveTargets(prefix?: string): Set<string> | null {
    if (!prefix) {
      return new Set(this.registeredPaths);
    }
    const normalized = this.normalizePath(prefix);
    if (!normalized) {
      return null;
    }
    const targets = this.pathsByPrefix.get(normalized);
    if (!targets) {
      return null;
    }
    return new Set(targets);
  }

  private registerPrefixes(path: string): void {
    const segments = path.split(".");
    let prefix = "";
    segments.forEach((segment) => {
      prefix = prefix ? `${prefix}.${segment}` : segment;
      const bucket = this.pathsByPrefix.get(prefix);
      if (bucket) {
        bucket.add(path);
      } else {
        this.pathsByPrefix.set(prefix, new Set([path]));
      }
    });
  }

  private buildSnapshot(): NewUnlockNotificationBridgeState {
    const unseenPaths: string[] = [];
    const unseenByPrefix: Record<string, string[]> = {};
    const topLevelUnseen: string[] = [];
    const topLevelSeen = new Set<string>();

    this.registeredPaths.forEach((path) => {
      const entry = this.entries.get(path);
      if (!entry || !entry.isUnlocked || entry.isViewed) {
        return;
      }
      unseenPaths.push(path);
      const segments = path.split(".");
      let prefix = "";
      segments.forEach((segment, index) => {
        prefix = prefix ? `${prefix}.${segment}` : segment;
        if (!unseenByPrefix[prefix]) {
          unseenByPrefix[prefix] = [];
        }
        unseenByPrefix[prefix].push(path);
        if (index === 0 && !topLevelSeen.has(prefix)) {
          topLevelSeen.add(prefix);
          topLevelUnseen.push(prefix);
        }
      });
    });

    return {
      unseenPaths,
      unseenByPrefix,
      topLevelUnseen,
    };
  }

  private pushSnapshot(snapshot: NewUnlockNotificationBridgeState): void {
    const hash = JSON.stringify(snapshot);
    if (hash === this.lastSnapshotHash) {
      return;
    }
    this.lastSnapshotHash = hash;
    DataBridgeHelpers.pushState(this.bridge, NEW_UNLOCKS_BRIDGE_KEY, snapshot);
  }

  private normalizePath(path: string): string {
    return path.trim();
  }
}
