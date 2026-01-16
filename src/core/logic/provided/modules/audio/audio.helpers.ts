import { getAssetUrl } from "@shared/helpers/assets.helper";

/**
 * Picks a random track index from the available tracks.
 * @param totalTracks - Total number of tracks
 * @returns Random index between 0 and totalTracks - 1, or 0 if invalid
 */
export const pickRandomTrackIndex = (totalTracks: number): number => {
  if (totalTracks <= 0 || !Number.isFinite(totalTracks)) {
    return 0;
  }
  if (totalTracks === 1) {
    return 0;
  }
  return Math.floor(Math.random() * totalTracks);
};

/**
 * Normalizes an effect URL by turning it into a usable asset URL.
 * @param url - URL to normalize
 * @returns Normalized asset URL, or empty string if url is falsy
 */
export const normalizeEffectUrl = (url: string): string => getAssetUrl(url);
