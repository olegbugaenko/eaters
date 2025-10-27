import { GameModule } from "../../core/types";
import {
  AudioSettingsPercentages,
  NormalizedAudioSettings,
  readStoredAudioSettings,
  toNormalizedAudioSettings,
} from "../../utils/audioSettings";

const DEFAULT_PLAYLISTS = {
  camp: [
    "/audio/music/camp-playlist/soft-calm-background-music-416544.mp3",
    "/audio/music/camp-playlist/youtube-background-music-lofi-398315.mp3",
  ],
  map: [
    "/audio/music/map-playlist/background-music-421081.mp3",
    "/audio/music/map-playlist/calm-soft-background-music-357212.mp3",
    "/audio/music/map-playlist/corporate-technology-background-music-424595.mp3",
    "/audio/music/map-playlist/inspiring-inspirational-background-music-412596.mp3",
  ],
} as const satisfies Record<string, readonly string[]>;

export type DefaultAudioPlaylistId = keyof typeof DEFAULT_PLAYLISTS;

interface AudioModuleOptions {
  playlists?: Record<string, readonly string[]>;
  defaultPlaylistId?: string | null;
}

export class AudioModule implements GameModule {
  public readonly id = "audio";

  private readonly playlists: Record<string, readonly string[]>;
  private readonly defaultPlaylistId: string | null;
  private musicElement: HTMLAudioElement | null = null;
  private currentTrackIndex = 0;
  private currentTrackUrl: string | null = null;
  private currentPlaylistId: string | null = null;
  private currentPlaylistTracks: readonly string[] = [];
  private masterVolume = 1;
  private musicVolume = 1;
  private effectsVolume = 1;
  private readonly effectTemplates = new Map<string, HTMLAudioElement>();
  private readonly activeEffectElements = new Set<HTMLAudioElement>();
  private readonly lastEffectPlayTimestamps = new Map<string, number>();
  private static readonly MIN_EFFECT_INTERVAL_MS = 200;

  constructor(options: AudioModuleOptions = {}) {
    this.playlists = {
      ...DEFAULT_PLAYLISTS,
      ...(options.playlists ?? {}),
    };

    const requestedDefault = options.defaultPlaylistId;
    if (requestedDefault && this.playlists[requestedDefault]?.length) {
      this.defaultPlaylistId = requestedDefault;
    } else {
      const firstPlaylistId = Object.keys(this.playlists)[0] ?? null;
      this.defaultPlaylistId = firstPlaylistId ?? null;
    }
  }

  public initialize(): void {
    if (typeof window === "undefined") {
      return;
    }

    this.applyPercentageSettings(readStoredAudioSettings());
    this.ensureMusicElement();
  }

  public reset(): void {
    if (typeof window === "undefined") {
      return;
    }

    this.stopMusic();
    this.currentTrackIndex = 0;
    this.currentTrackUrl = null;
    this.currentPlaylistId = null;
    this.currentPlaylistTracks = [];
    this.stopAllEffects();
    this.lastEffectPlayTimestamps.clear();
    this.ensureMusicElement();
  }

  public load(_data: unknown | undefined): void {
    // Audio settings are stored in local storage, nothing to load from save slots yet.
  }

  public save(): unknown {
    return undefined;
  }

  public tick(_deltaMs: number): void {
    // Music playback relies on media events rather than manual ticking.
  }

  public applyPercentageSettings(settings: AudioSettingsPercentages): void {
    this.applySettings(toNormalizedAudioSettings(settings));
  }

  public applySettings(settings: Partial<NormalizedAudioSettings>): void {
    if (typeof window === "undefined") {
      return;
    }

    if (settings.masterVolume !== undefined) {
      this.masterVolume = this.clamp01(settings.masterVolume);
    }
    if (settings.musicVolume !== undefined) {
      this.musicVolume = this.clamp01(settings.musicVolume);
    }
    if (settings.effectsVolume !== undefined) {
      this.effectsVolume = this.clamp01(settings.effectsVolume);
    }

    this.syncMusicVolume();
    this.syncEffectVolumes();
  }

  public playSoundEffect(url: string): void {
    if (typeof window === "undefined") {
      return;
    }

    const now = this.getNow();
    const lastPlay = this.lastEffectPlayTimestamps.get(url) ?? -Infinity;
    if (now - lastPlay < AudioModule.MIN_EFFECT_INTERVAL_MS) {
      return;
    }

    const template = this.resolveEffectTemplate(url);
    if (!template) {
      return;
    }

    this.lastEffectPlayTimestamps.set(url, now);

    const element = template.cloneNode(true) as HTMLAudioElement;
    element.currentTime = 0;
    element.volume = this.clamp01(this.masterVolume * this.effectsVolume);

    const cleanup = () => {
      this.activeEffectElements.delete(element);
      element.removeEventListener("ended", cleanup);
      element.removeEventListener("pause", cleanup);
      element.removeEventListener("error", cleanup);
    };

    element.addEventListener("ended", cleanup);
    element.addEventListener("pause", cleanup);
    element.addEventListener("error", cleanup);

    this.activeEffectElements.add(element);

    const playPromise = element.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => {
        cleanup();
      });
    }
  }

  public resumeMusic(): void {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.currentPlaylistTracks.length) {
      if (this.defaultPlaylistId) {
        const defaultTracks = this.playlists[this.defaultPlaylistId] ?? [];
        if (defaultTracks.length) {
          this.currentPlaylistId = this.defaultPlaylistId;
          this.currentPlaylistTracks = defaultTracks;
          this.currentTrackUrl = null;
          this.currentTrackIndex = this.pickRandomTrackIndex(defaultTracks.length);
        }
      }
    }

    if (!this.currentPlaylistTracks.length) {
      return;
    }

    if (this.currentTrackUrl === null || this.currentTrackIndex >= this.currentPlaylistTracks.length) {
      this.currentTrackIndex = this.pickRandomTrackIndex(this.currentPlaylistTracks.length);
      this.currentTrackUrl = null;
    }

    const element = this.loadCurrentTrack();
    if (!element) {
      return;
    }

    this.playElement(element);
  }

  public playPlaylist(playlistId: string): void {
    if (typeof window === "undefined") {
      return;
    }

    const tracks = this.playlists[playlistId];
    if (!tracks || !tracks.length) {
      console.warn("AudioModule: attempted to play an empty playlist", {
        playlistId,
      });
      return;
    }

    this.stopMusic();
    this.currentPlaylistId = playlistId;
    this.currentPlaylistTracks = tracks;
    this.currentTrackIndex = this.pickRandomTrackIndex(tracks.length);
    this.currentTrackUrl = null;

    const element = this.loadCurrentTrack();
    if (!element) {
      return;
    }

    element.currentTime = 0;
    this.playElement(element);
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.musicElement) {
      return this.musicElement;
    }

    const element = new Audio();
    element.preload = "auto";
    element.loop = false;
    element.addEventListener("ended", this.handleTrackEnded);
    element.addEventListener("error", this.handleTrackError);

    this.musicElement = element;
    if (this.currentTrackUrl) {
      element.src = this.currentTrackUrl;
    }
    this.syncMusicVolume();

    return element;
  }

  private loadCurrentTrack(): HTMLAudioElement | null {
    const element = this.ensureMusicElement();
    if (!element) {
      return null;
    }

    if (!this.currentPlaylistTracks.length) {
      return null;
    }

    if (this.currentTrackIndex >= this.currentPlaylistTracks.length) {
      this.currentTrackIndex = this.currentPlaylistTracks.length - 1;
    }

    const nextUrl = this.resolveTrackUrl(this.currentTrackIndex);
    if (!nextUrl) {
      return null;
    }
    if (this.currentTrackUrl !== nextUrl) {
      element.src = nextUrl;
      this.currentTrackUrl = nextUrl;
    }

    return element;
  }

  private handleTrackEnded = (): void => {
    this.advanceTrack();
  };

  private handleTrackError = (): void => {
    console.warn("Failed to play music track", {
      index: this.currentTrackIndex,
      url: this.currentTrackUrl,
    });
    this.advanceTrack();
  };

  private advanceTrack(): void {
    if (!this.currentPlaylistTracks.length) {
      return;
    }

    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentPlaylistTracks.length;
    const element = this.loadCurrentTrack();
    if (!element) {
      return;
    }
    element.currentTime = 0;
    this.playElement(element);
  }

  private playElement(element: HTMLAudioElement): void {
    this.syncMusicVolume();
    const playPromise = element.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .catch((error) => {
          console.warn("Autoplay prevented or playback failed", error);
        });
    }
  }

  private syncMusicVolume(): void {
    if (!this.musicElement) {
      return;
    }

    const computedVolume = this.clamp01(this.masterVolume * this.musicVolume);
    this.musicElement.volume = computedVolume;
  }

  private syncEffectVolumes(): void {
    const computedVolume = this.clamp01(this.masterVolume * this.effectsVolume);
    this.activeEffectElements.forEach((element) => {
      element.volume = computedVolume;
    });
  }

  private stopMusic(): void {
    if (!this.musicElement) {
      return;
    }

    this.musicElement.pause();
    this.musicElement.currentTime = 0;
  }

  private stopAllEffects(): void {
    this.activeEffectElements.forEach((element) => {
      element.pause();
      element.currentTime = 0;
    });
    this.activeEffectElements.clear();
  }

  private resolveTrackUrl(index: number): string {
    const fallbackTrack = this.currentPlaylistTracks[0];
    const track = this.currentPlaylistTracks[index] ?? fallbackTrack;
    if (!track) {
      console.warn("AudioModule: attempted to resolve an undefined music track", {
        index,
        playlistId: this.currentPlaylistId,
        tracks: this.currentPlaylistTracks.length,
      });
      return "";
    }
    if (!track.startsWith("/")) {
      return `/${track}`;
    }
    return track;
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return value;
  }

  private pickRandomTrackIndex(totalTracks: number): number {
    if (totalTracks <= 0 || !Number.isFinite(totalTracks)) {
      return 0;
    }
    if (totalTracks === 1) {
      return 0;
    }
    return Math.floor(Math.random() * totalTracks);
  }

  private resolveEffectTemplate(url: string): HTMLAudioElement | null {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      return null;
    }

    const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
    let template = this.effectTemplates.get(normalizedUrl);
    if (!template) {
      template = new Audio(normalizedUrl);
      template.preload = "auto";
      this.effectTemplates.set(normalizedUrl, template);
    }
    return template;
  }

  private getNow(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }
}
