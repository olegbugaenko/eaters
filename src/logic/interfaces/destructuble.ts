import type { ExplosionType } from "../../db/explosions-db";

export interface DestructubleData {
    hp?: number;
    maxHp: number;
    armor: number;
    baseDamage?: number;
    brickKnockBackDistance?: number;
    brickKnockBackSpeed?: number;
    physicalSize?: number;
    hitExplosionType?: ExplosionType;
    destroyExplosionType?: ExplosionType;
}