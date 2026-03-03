import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DamageApplicationOptions } from "./targeting/DamageService";
import type { TargetSnapshot, TargetType } from "./targeting/targeting.types";
import type { ArcSpawnOptions, ArcTargetRef } from "../scene/arc/arc.types";
import type { ArcType } from "../../../db/arcs-db";
import type { ExplosionType } from "../../../db/explosions-db";
import { subtractVectors, vectorHasLength } from "@/shared/helpers/vector.helper";

export type ChainLightningTargetType = "brick" | "enemy" | "unit";

export interface ChainLightningTarget {
  id: string;
  type: ChainLightningTargetType;
  position: SceneVector2;
}

export interface ChainLightningDependencies {
  getTargetsInRadius: (
    position: SceneVector2,
    radius: number,
    types?: readonly TargetType[],
  ) => TargetSnapshot[];
  applyTargetDamage?: (
    targetId: string,
    damage: number,
    options?: DamageApplicationOptions,
  ) => number;
  applyBrickDamage?: (
    brickId: string,
    damage: number,
    options?: DamageApplicationOptions,
  ) => number;
  spawnArcBetweenTargets?: (
    arcType: ArcType,
    source: ArcTargetRef,
    target: ArcTargetRef,
    options?: ArcSpawnOptions,
  ) => void;
  spawnExplosionByType?: (
    type: ExplosionType,
    options: { position: SceneVector2; initialRadius?: number },
  ) => void;
}

export interface ChainLightningOptions {
  startTarget: ChainLightningTarget;
  chainRadius: number;
  chainJumps: number;
  damage: number;
  damageOptions?: DamageApplicationOptions;
  dependencies: ChainLightningDependencies;
  arcType?: ArcType;
  explosionType?: ExplosionType;
  /** Target types to chain to (default ["brick", "enemy"]; use ["unit"] for enemy→unit chain). */
  chainTargetTypes?: readonly ChainLightningTargetType[];
}

const DEFAULT_CHAIN_TARGET_TYPES: readonly ChainLightningTargetType[] = [
  "brick",
  "enemy",
];

export const executeChainLightning = ({
  startTarget,
  chainRadius,
  chainJumps,
  damage,
  damageOptions,
  dependencies,
  arcType,
  explosionType,
  chainTargetTypes = DEFAULT_CHAIN_TARGET_TYPES,
}: ChainLightningOptions): boolean => {
  if (chainRadius <= 0 || chainJumps <= 0 || damage <= 0) {
    return false;
  }
  if (!dependencies.getTargetsInRadius) {
    return false;
  }

  const allowedTypes: readonly string[] = chainTargetTypes;
  let currentTarget = startTarget;
  const visited = new Set<string>([`${startTarget.type}:${startTarget.id}`]);
  let chained = false;

  for (let i = 0; i < chainJumps; i += 1) {
    const candidates = dependencies
      .getTargetsInRadius(currentTarget.position, chainRadius, [...chainTargetTypes])
      .filter((candidate): candidate is TargetSnapshot<ChainLightningTargetType> => {
        const key = `${candidate.type}:${candidate.id}`;
        return !visited.has(key) && allowedTypes.includes(candidate.type);
      });

    if (candidates.length === 0) {
      break;
    }

    const nextCandidate = candidates[Math.floor(Math.random() * candidates.length)]!;
    const nextTarget: ChainLightningTarget = {
      id: nextCandidate.id,
      type: nextCandidate.type,
      position: nextCandidate.position,
    };
    const direction = subtractVectors(nextTarget.position, currentTarget.position);
    const resolvedOptions: DamageApplicationOptions = {
      ...damageOptions,
      direction: vectorHasLength(direction) ? direction : damageOptions?.direction,
    };

    if (dependencies.applyTargetDamage) {
      dependencies.applyTargetDamage(nextTarget.id, damage, resolvedOptions);
    } else if (nextTarget.type === "brick") {
      dependencies.applyBrickDamage?.(nextTarget.id, damage, resolvedOptions);
    }

    const sourceRef = { type: currentTarget.type, id: currentTarget.id };
    const targetRef = { type: nextTarget.type, id: nextTarget.id };
    if (dependencies.spawnArcBetweenTargets && arcType) {
      dependencies.spawnArcBetweenTargets(
        arcType,
        sourceRef,
        targetRef,
        {
          persistOnDeath: true,
          sourcePosition: currentTarget.position,
          targetPosition: nextTarget.position,
        },
      );
    }

    if (dependencies.spawnExplosionByType && explosionType) {
      dependencies.spawnExplosionByType(explosionType, {
        position: { ...nextTarget.position },
      });
    }

    const key = `${nextTarget.type}:${nextTarget.id}`;
    visited.add(key);
    currentTarget = nextTarget;
    chained = true;
  }

  return chained;
};
