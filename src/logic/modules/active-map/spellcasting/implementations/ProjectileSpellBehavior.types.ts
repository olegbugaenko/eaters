import type { ExplosionType } from "../../../../../db/explosions-db";

export interface ProjectileSpellData {
  spellId: string;
  seriesId?: string;
  damage: { min: number; max: number };
  damageMultiplier: number;
  aoe?: { radius: number; splash: number };
  explosion?: ExplosionType;
}
