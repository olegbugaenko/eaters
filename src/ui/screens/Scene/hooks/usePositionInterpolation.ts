import { useRef, useEffect } from "react";
import type { SceneVector2, SceneUiApi } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { GameLoopUiApi } from "@core/logic/provided/services/game-loop/game-loop.types";
import { TICK_INTERVAL } from "@core/logic/provided/services/game-loop/game-loop.const";
import { lerpAngle } from "@shared/helpers/angle.helper";
import {
  getAllActiveBullets,
  type BulletInterpolatedState,
} from "@ui/renderers/primitives/gpu/bullet/BulletGpuRenderer";
import { clamp } from "@shared/helpers/numbers.helper";

const DRIFT_SNAP_THRESHOLD = TICK_INTERVAL * 1.25;

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

interface BulletRenderSnapshot extends UnitRenderSnapshot {
  prevMovementRotation: number;
  nextMovementRotation: number;
  prevVisualRotation: number;
  nextVisualRotation: number;
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
  scene: SceneUiApi,
  gameLoop: GameLoopUiApi
) => {
  const unitSnapshotsRef = useRef<Map<string, UnitRenderSnapshot>>(new Map());
  const interpolatedPositionsRef = useRef<Map<string, SceneVector2>>(new Map());
  const interpolatedBulletPositionsRef = useRef<Map<string, BulletInterpolatedState>>(
    new Map()
  );
  const interpolatedBrickPositionsRef = useRef<Map<string, SceneVector2>>(new Map());
  const interpolatedEnemyPositionsRef = useRef<Map<string, SceneVector2>>(new Map());
  const activeBulletKeysRef = useRef<Set<string>>(new Set());
  const bulletSnapshotsRef = useRef<Map<string, BulletRenderSnapshot>>(new Map());
  const brickSnapshotsRef = useRef<Map<string, UnitRenderSnapshot>>(new Map());
  const enemySnapshotsRef = useRef<Map<string, UnitRenderSnapshot>>(new Map());

  // Sync snapshots with game loop ticks
  useEffect(() => {
    const syncBulletSnapshots = (timestamp: number) => {
      const nextKeys = new Set<string>();
      const snapshots = bulletSnapshotsRef.current;
      const activeBullets = getAllActiveBullets();
      
      activeBullets.forEach((item) => {
        const { handle, position, movementRotation, visualRotation } = item;
        const key = `${handle.batchKey}:${handle.slotIndex}`;
        nextKeys.add(key);
        const existing = snapshots.get(key);
        
        if (!existing) {
          // New bullet - mark as first tick
          // GPU buffer already has correct position from spawn/tick, don't override
          snapshots.set(key, {
            prev: { ...position },
            next: { ...position },
            prevMovementRotation: movementRotation,
            nextMovementRotation: movementRotation,
            prevVisualRotation: visualRotation,
            nextVisualRotation: visualRotation,
            lastTickAt: timestamp,
            tickCount: 1,
          });
        } else {
          // Existing bullet - normal interpolation
          snapshots.set(key, {
            prev: existing.next,
            next: { ...position },
            prevMovementRotation: existing.nextMovementRotation,
            nextMovementRotation: movementRotation,
            prevVisualRotation: existing.nextVisualRotation,
            nextVisualRotation: visualRotation,
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

    const syncMovableSnapshots = (timestamp: number) => {
      const unitSnapshots = unitSnapshotsRef.current;
      const brickSnapshots = brickSnapshotsRef.current;
      const enemySnapshots = enemySnapshotsRef.current;
      const nextUnitIds = new Set<string>();
      const nextBrickIds = new Set<string>();
      const nextEnemyIds = new Set<string>();

      scene.forEachMovableObject((instance) => {
        switch (instance.type) {
          case "playerUnit": {
            nextUnitIds.add(instance.id);
            const existing = unitSnapshots.get(instance.id);
            const previous = existing?.next ?? { ...instance.data.position };
            unitSnapshots.set(instance.id, {
              prev: previous,
              next: { ...instance.data.position },
              lastTickAt: timestamp,
            });
            break;
          }
          case "brick": {
            nextBrickIds.add(instance.id);
            const existing = brickSnapshots.get(instance.id);
            const previous = existing?.next ?? { ...instance.data.position };
            brickSnapshots.set(instance.id, {
              prev: previous,
              next: { ...instance.data.position },
              lastTickAt: timestamp,
            });
            break;
          }
          case "enemy": {
            nextEnemyIds.add(instance.id);
            const existing = enemySnapshots.get(instance.id);
            const previous = existing?.next ?? { ...instance.data.position };
            enemySnapshots.set(instance.id, {
              prev: previous,
              next: { ...instance.data.position },
              lastTickAt: timestamp,
            });
            break;
          }
          default:
            break;
        }
      });

      Array.from(unitSnapshots.keys()).forEach((id) => {
        if (!nextUnitIds.has(id)) {
          unitSnapshots.delete(id);
        }
      });
      Array.from(brickSnapshots.keys()).forEach((id) => {
        if (!nextBrickIds.has(id)) {
          brickSnapshots.delete(id);
        }
      });
      Array.from(enemySnapshots.keys()).forEach((id) => {
        if (!nextEnemyIds.has(id)) {
          enemySnapshots.delete(id);
        }
      });
    };

    syncMovableSnapshots(gameLoop.getLastTickTimestamp() || getNow());
    syncBulletSnapshots(gameLoop.getLastTickTimestamp() || getNow());
    const unsubscribe = gameLoop.addTickListener(({ timestamp }) => {
      syncMovableSnapshots(timestamp);
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
      // OPTIMIZATION: Skip stationary units (position hasn't changed)
      if (
        snapshot.prev.x === snapshot.next.x &&
        snapshot.prev.y === snapshot.next.y
      ) {
        return;
      }
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
    const positions = interpolatedBulletPositionsRef.current;
    positions.clear();
    if (snapshots.size === 0) {
      return positions;
    }
    
    // Only interpolate for bullets that are still active
    const activeBullets = getAllActiveBullets();
    const activeKeys = activeBulletKeysRef.current;
    activeKeys.clear();
    activeBullets.forEach((item) => {
      activeKeys.add(`${item.handle.batchKey}:${item.handle.slotIndex}`);
    });
    
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
      positions.set(key, {
        position: lerpVector(snapshot.prev, snapshot.next, alpha),
        movementRotation: lerpAngle(
          snapshot.prevMovementRotation,
          snapshot.nextMovementRotation,
          alpha
        ),
        visualRotation: lerpAngle(
          snapshot.prevVisualRotation,
          snapshot.nextVisualRotation,
          alpha
        ),
      });
    });
    return positions;
  };

  const getInterpolatedBrickPositions = () => {
    const snapshots = brickSnapshotsRef.current;
    const positions = interpolatedBrickPositionsRef.current;
    positions.clear();
    if (snapshots.size === 0) {
      return positions;
    }
    const now = getNow();
    snapshots.forEach((snapshot, id) => {
      // OPTIMIZATION: Skip static bricks (position hasn't changed)
      // This prevents unnecessary RectanglePrimitive.update calls
      if (
        snapshot.prev.x === snapshot.next.x &&
        snapshot.prev.y === snapshot.next.y
      ) {
        return;
      }
      const elapsed = Math.max(now - snapshot.lastTickAt, 0);
      const alpha =
        elapsed > DRIFT_SNAP_THRESHOLD
          ? 1
          : clamp(elapsed / TICK_INTERVAL, 0, 1);
      positions.set(id, lerpVector(snapshot.prev, snapshot.next, alpha));
    });
    return positions;
  };

  const getInterpolatedEnemyPositions = () => {
    const snapshots = enemySnapshotsRef.current;
    const positions = interpolatedEnemyPositionsRef.current;
    positions.clear();
    if (snapshots.size === 0) {
      return positions;
    }
    const now = getNow();
    snapshots.forEach((snapshot, id) => {
      // OPTIMIZATION: Skip stationary enemies (position hasn't changed)
      if (
        snapshot.prev.x === snapshot.next.x &&
        snapshot.prev.y === snapshot.next.y
      ) {
        return;
      }
      const elapsed = Math.max(now - snapshot.lastTickAt, 0);
      const alpha =
        elapsed > DRIFT_SNAP_THRESHOLD
          ? 1
          : clamp(elapsed / TICK_INTERVAL, 0, 1);
      positions.set(id, lerpVector(snapshot.prev, snapshot.next, alpha));
    });
    return positions;
  };

  return {
    getInterpolatedUnitPositions,
    getInterpolatedBulletPositions,
    getInterpolatedBrickPositions,
    getInterpolatedEnemyPositions,
  };
};
