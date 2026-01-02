import type { DEFAULT_PLAYLISTS } from "./audio.const";

/**
 * Interface for playing sound effects.
 * Used by modules that need to play audio effects (bricks, player units, etc.)
 */
export interface SoundEffectPlayer {
  playSoundEffect(url: string): void;
}

export type DefaultAudioPlaylistId = keyof typeof DEFAULT_PLAYLISTS;

export interface AudioModuleOptions {
  playlists?: Record<string, readonly string[]>;
  defaultPlaylistId?: string | null;
}
