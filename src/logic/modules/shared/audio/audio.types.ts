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

export interface AudioModuleUiApi {
  applyPercentageSettings(settings: import("../../../utils/audioSettings").AudioSettingsPercentages): void;
  playPlaylist(playlistId: string): void;
}

declare module "@/core/logic/ui/ui-api.registry" {
  interface LogicUiApiRegistry {
    audio: AudioModuleUiApi;
  }
}
