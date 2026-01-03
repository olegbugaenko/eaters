import { useRef, useEffect } from "react";
import { SceneVector2 } from "@logic/services/scene-object-manager/scene-object-manager.types";
import { SceneObjectManager } from "@logic/services/scene-object-manager/SceneObjectManager";
import { GameLoop } from "@logic/services/game-loop/GameLoop";
import { TICK_INTERVAL } from "@logic/services/game-loop/game-loop.const";
import { getAllActiveBullets } from "@ui/renderers/primitives/gpu/BulletGpuRenderer";

const DRIFT_SNAP_THRESHOLD = TICK_INTERVAL * 1.25;

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const lerpVector = (from: SceneVector2, to: SceneVector2, alpha: number): SceneVector2 => ({
  x: from.x + (to.x - from.x) * alpha,
  y: from.y + (to.y - from.y) * alpha,
});

interface UnitRenderSnapshot {
  prev: SceneVector2;
  next: SceneVector2;
  lastTickAt: number;
  tickCount?: number; // For bullets: skip interpolation on first tick
}

const getNow = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Hook for managing position interpolation for units and bullets.
 * Provides smooth animation between game ticks.
 */
export const usePositionInterpolation = (
  scene: SceneObjectManager,
  gameLoop: GameLoop
) => {
  const unitSnapshotsRef = useRef<Map<string, UnitRenderSnapshot>>(new Map());
  const interpolatedPositionsRef = useRef<Map<string, SceneVector2>>(new Map());
  const bulletSnapshotsRef = useRef<Map<string, UnitRenderSnapshot>>(new Map());

  // Sync snapshots with game loop ticks
  useEffect(() => {
    const syncUnitSnapshots = (timestamp: number) => {
      const nextIds = new Set<string>();
      const snapshots = unitSnapshotsRef.current;
      scene
        .getObjects()
        .filter((instance) => instance.type === "playerUnit")
        .forEach((instance) => {
          nextIds.add(instance.id);
          const existing = snapshots.get(instance.id);
          const previous = existing?.next ?? { ...instance.data.position };
          snapshots.set(instance.id, {
            prev: previous,
            next: { ...instance.data.position },
            lastTickAt: timestamp,
          });
        });
      Array.from(snapshots.keys()).forEach((id) => {
        if (!nextIds.has(id)) {
          snapshots.delete(id);
        }
      });
    };

    const syncBulletSnapshots = (timestamp: number) => {
      const nextKeys = new Set<string>();
      const snapshots = bulletSnapshotsRef.current;
      const activeBullets = getAllActiveBullets();
      
      activeBullets.forEach((item) => {
        const { handle, position } = item;
        const key = `${handle.visualKey}:${handle.slotIndex}`;
        nextKeys.add(key);
        const existing = snapshots.get(key);
        
        if (!existing) {
          // New bullet - mark as first tick
          // GPU buffer already has correct position from spawn/tick, don't override
          snapshots.set(key, {
            prev: { ...position },
            next: { ...position },
            lastTickAt: timestamp,
            tickCount: 1,
          });
        } else {
          // Existing bullet - normal interpolation
          snapshots.set(key, {
            prev: existing.next,
            next: { ...position },
            lastTickAt: timestamp,
            tickCount: (existing.tickCount ?? 1) + 1,
          });
        }
      });
      
      // Clean up snapshots for bullets that no longer exist
      Array.from(snapshots.keys()).forEach((key) => {
        if (!nextKeys.has(key)) {
          snapshots.delete(key);
        }
      });
    };

    syncUnitSnapshots(gameLoop.getLastTickTimestamp() || getNow());
    syncBulletSnapshots(gameLoop.getLastTickTimestamp() || getNow());
    const unsubscribe = gameLoop.addTickListener(({ timestamp }) => {
      syncUnitSnapshots(timestamp);
      syncBulletSnapshots(timestamp);
    });
    return () => {
      unsubscribe();
    };
  }, [gameLoop, scene]);

  const getInterpolatedUnitPositions = () => {
    const snapshots = unitSnapshotsRef.current;
    const positions = interpolatedPositionsRef.current;
    positions.clear();
    if (snapshots.size === 0) {
      return positions;
    }
    const now = getNow();
    snapshots.forEach((snapshot, id) => {
      const elapsed = Math.max(now - snapshot.lastTickAt, 0);
      const alpha =
        elapsed > DRIFT_SNAP_THRESHOLD
          ? 1
          : clamp(elapsed / TICK_INTERVAL, 0, 1);
      positions.set(id, lerpVector(snapshot.prev, snapshot.next, alpha));
    });
    return positions;
  };

  const getInterpolatedBulletPositions = () => {
    const snapshots = bulletSnapshotsRef.current;
    const positions = new Map<string, SceneVector2>();
    if (snapshots.size === 0) {
      return positions;
    }
    
    // Only interpolate for bullets that are still active
    const activeBullets = getAllActiveBullets();
    const activeKeys = new Set(activeBullets.map((item) => `${item.handle.visualKey}:${item.handle.slotIndex}`));
    
    const now = getNow();
    snapshots.forEach((snapshot, key) => {
      // CRITICAL: Only interpolate if bullet is still active!
      if (!activeKeys.has(key)) {
        // Clean up snapshot for removed bullet
        snapshots.delete(key);
        return;
      }
      
      // For first tick (tickCount === 1), don't apply interpolation at all
      // GPU buffer already has correct position from spawn/tick
      // Adding to positions would OVERRIDE that correct position
      if ((snapshot.tickCount ?? 1) <= 1) {
        // Skip - let GPU keep its current correct position
        return;
      }
      
      const elapsed = Math.max(now - snapshot.lastTickAt, 0);
      
      // For existing bullets with proper history, apply interpolation
      const alpha =
        elapsed > DRIFT_SNAP_THRESHOLD
          ? 1
          : clamp(elapsed / TICK_INTERVAL, 0, 1);
      positions.set(key, lerpVector(snapshot.prev, snapshot.next, alpha));
    });
    return positions;
  };

  return {
    getInterpolatedUnitPositions,
    getInterpolatedBulletPositions,
  };
};
