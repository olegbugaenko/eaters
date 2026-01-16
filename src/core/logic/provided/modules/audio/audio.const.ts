import { getAssetUrl } from "@shared/helpers/assets.helper";

export const DEFAULT_PLAYLISTS = {
  camp: [
    getAssetUrl("audio/music/camp-playlist/soft-calm-background-music-416544.mp3"),
    getAssetUrl("audio/music/camp-playlist/youtube-background-music-lofi-398315.mp3"),
  ],
  map: [
    getAssetUrl("audio/music/map-playlist/background-music-421081.mp3"),
    getAssetUrl("audio/music/map-playlist/calm-soft-background-music-357212.mp3"),
    getAssetUrl("audio/music/map-playlist/corporate-technology-background-music-424595.mp3"),
    getAssetUrl("audio/music/map-playlist/inspiring-inspirational-background-music-412596.mp3"),
  ],
} as const satisfies Record<string, readonly string[]>;

export const MIN_EFFECT_INTERVAL_MS = 400;
export const MAX_EFFECT_INSTANCES = 24;
export const MAX_EFFECT_INSTANCES_PER_SOUND = 4;
export const MUSIC_VOLUME_MULTIPLIER = 0.3;
