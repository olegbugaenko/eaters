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
 * Normalizes an effect URL by ensuring it starts with "/".
 * @param url - URL to normalize
 * @returns Normalized URL starting with "/", or empty string if url is falsy
 */
export const normalizeEffectUrl = (url: string): string => {
  if (!url) {
    return "";
  }
  return url.startsWith("/") ? url : `/${url}`;
};
