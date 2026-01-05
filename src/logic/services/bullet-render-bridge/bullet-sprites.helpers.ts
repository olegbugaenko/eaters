import type { BulletSpriteName } from "./bullet-sprites.const";
import { BULLET_SPRITE_INDEX } from "./bullet-sprites.const";

/**
 * Resolves sprite index by sprite name.
 */
export const resolveBulletSpriteIndex = (
  name: BulletSpriteName
): number => BULLET_SPRITE_INDEX[name];
