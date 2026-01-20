import type { SceneVector2 } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import type { DamageApplicationOptions } from "./targeting/DamageService";
import type { TargetSnapshot, TargetType } from "./targeting/targeting.types";
import type { ArcSpawnOptions, ArcTargetRef } from "../scene/arc/arc.types";
import type { ArcType } from "../../../db/arcs-db";
import { subtractVectors, vectorHasLength } from "@/shared/helpers/vector.helper";

export interface ChainLightningTarget {
  id: string;
  type: "brick" | "enemy";
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
}

export interface ChainLightningOptions {
  startTarget: ChainLightningTarget;
  chainRadius: number;
  chainJumps: number;
  damage: number;
  damageOptions?: DamageApplicationOptions;
  dependencies: ChainLightningDependencies;
  arcType?: ArcType;
}

const isChainTarget = (
  candidate: TargetSnapshot,
): candidate is TargetSnapshot<"brick" | "enemy"> =>
  candidate.type === "brick" || candidate.type === "enemy";

export const executeChainLightning = ({
  startTarget,
  chainRadius,
  chainJumps,
  damage,
  damageOptions,
  dependencies,
  arcType,
}: ChainLightningOptions): boolean => {
  if (chainRadius <= 0 || chainJumps <= 0 || damage <= 0) {
    return false;
  }
  if (!dependencies.getTargetsInRadius) {
    return false;
  }

  let currentTarget = startTarget;
  const visited = new Set<string>([`${startTarget.type}:${startTarget.id}`]);
  let chained = false;

  for (let i = 0; i < chainJumps; i += 1) {
    const candidates = dependencies
      .getTargetsInRadius(currentTarget.position, chainRadius, ["brick", "enemy"])
      .filter((candidate): candidate is TargetSnapshot<"brick" | "enemy"> => {
        const key = `${candidate.type}:${candidate.id}`;
        return !visited.has(key) && isChainTarget(candidate);
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

    if (dependencies.spawnArcBetweenTargets && arcType) {
      dependencies.spawnArcBetweenTargets(
        arcType,
        { type: currentTarget.type, id: currentTarget.id },
        { type: nextTarget.type, id: nextTarget.id },
        {
          persistOnDeath: true,
          sourcePosition: currentTarget.position,
          targetPosition: nextTarget.position,
        },
      );
    }

    const key = `${nextTarget.type}:${nextTarget.id}`;
    visited.add(key);
    currentTarget = nextTarget;
    chained = true;
  }

  return chained;
};
