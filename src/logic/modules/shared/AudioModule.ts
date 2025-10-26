import { GameModule } from "../../core/types";
import {
  AudioSettingsPercentages,
  NormalizedAudioSettings,
  readStoredAudioSettings,
  toNormalizedAudioSettings,
} from "../../utils/audioSettings";

const DEFAULT_MUSIC_TRACKS: readonly string[] = [
  "/audio/music/background-music-421081.mp3",
  "/audio/music/calm-soft-background-music-357212.mp3",
  "/audio/music/corporate-technology-background-music-424595.mp3",
  "/audio/music/inspiring-inspirational-background-music-412596.mp3",
  "/audio/music/soft-calm-background-music-416544.mp3",
  "/audio/music/youtube-background-music-lofi-398315.mp3",
];

interface AudioModuleOptions {
  musicTracks?: readonly string[];
}

export class AudioModule implements GameModule {
  public readonly id = "audio";

  private readonly musicTracks: readonly string[];
  private musicElement: HTMLAudioElement | null = null;
  private currentTrackIndex = 0;
  private currentTrackUrl: string | null = null;
  private masterVolume = 1;
  private musicVolume = 1;
  private effectsVolume = 1;

  constructor(options: AudioModuleOptions = {}) {
    this.musicTracks = options.musicTracks ?? DEFAULT_MUSIC_TRACKS;
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
  }

  public resumeMusic(): void {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.musicTracks.length) {
      return;
    }

    const element = this.loadCurrentTrack();
    if (!element) {
      return;
    }

    this.playElement(element);
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.musicTracks.length) {
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

    if (!this.musicTracks.length) {
      return null;
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
    if (!this.musicTracks.length) {
      return;
    }

    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.musicTracks.length;
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

  private stopMusic(): void {
    if (!this.musicElement) {
      return;
    }

    this.musicElement.pause();
    this.musicElement.currentTime = 0;
  }

  private resolveTrackUrl(index: number): string {
    const fallbackTrack = this.musicTracks[0];
    const track = this.musicTracks[index] ?? fallbackTrack;
    if (!track) {
      console.warn("AudioModule: attempted to resolve an undefined music track", {
        index,
        tracks: this.musicTracks.length,
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
}
