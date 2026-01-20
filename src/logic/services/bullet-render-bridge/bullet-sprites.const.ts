import { getAssetUrl } from "@shared/helpers/assets.helper";

export const BULLET_SPRITE_SIZE = 32; // All sprites must be 32x32

export const BULLET_SPRITE_NAMES = [
  "needle",
  "fireball",
  "magic_arrow",
  "energetic_strike",
  "electricity_orb",
] as const;
export type BulletSpriteName = (typeof BULLET_SPRITE_NAMES)[number];

export const BULLET_SPRITE_PATHS = BULLET_SPRITE_NAMES.map((name) =>
  getAssetUrl(`images/sprites/${name}.png`)
);

export const BULLET_SPRITE_INDEX: Record<BulletSpriteName, number> =
  BULLET_SPRITE_NAMES.reduce((map, name, index) => {
    map[name] = index;
    return map;
  }, {} as Record<BulletSpriteName, number>);
