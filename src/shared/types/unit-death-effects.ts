import type { ExplosionType } from "@db/explosions-db";

export type UnitDeathEffect =
  | {
      kind: "explosion";
      type: ExplosionType;
      initialRadius?: number;
    };

export type UnitDeathEffects = readonly UnitDeathEffect[];
