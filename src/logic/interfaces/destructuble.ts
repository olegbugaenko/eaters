import type { ExplosionType } from "../../db/explosions-db";

export interface DestructubleExplosionConfig {
    type: ExplosionType;
    /**
     * Overrides the radius passed to the explosion module. When provided it takes
     * precedence over the multiplier and offset values.
     */
    initialRadius?: number;
    /**
     * Scales the base radius of the brick before applying the offset. Defaults to 1.
     */
    radiusMultiplier?: number;
    /**
     * Adds a constant value to the computed initial radius.
     */
    radiusOffset?: number;
}

export interface DestructubleData {
    hp?: number;
    maxHp: number;
    armor: number;
    baseDamage?: number;
    brickKnockBackDistance?: number;
    brickKnockBackSpeed?: number;
    brickKnockBackAmplitude?: number;
    physicalSize?: number;
    damageExplosion?: DestructubleExplosionConfig;
    destructionExplosion?: DestructubleExplosionConfig;
}