import assert from "assert";
import { describe, test } from "./testRunner";
import { AudioModule } from "../src/core/logic/provided/modules/audio/audio.module";

describe("AudioModule sound throttling", () => {
  const setupEnvironment = () => {
    const plays: string[] = [];
    let now = 10_000;

    const globals = globalThis as Record<string, unknown>;
    const originalWindow = globals.window;
    const originalPerformance = globals.performance;
    const originalAudio = globals.Audio;

    class FakeAudio {
      public src: string;
      public currentTime = 0;
      public volume = 1;
      public preload = "";

      constructor(src?: string) {
        this.src = src ?? "";
      }

      public cloneNode(_deep?: boolean): FakeAudio {
        return new FakeAudio(this.src);
      }

      public play(): Promise<void> {
        plays.push(this.src);
        return Promise.resolve();
      }

      public addEventListener(): void {}

      public removeEventListener(): void {}

      public pause(): void {}
    }

    globals.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    };
    globals.Audio = FakeAudio as unknown as typeof Audio;
    globals.performance = {
      now: () => now,
    };

    const module = new AudioModule();

    const advance = (ms: number) => {
      now += ms;
    };

    const cleanup = () => {
      if (originalWindow === undefined) {
        delete globals.window;
      } else {
        globals.window = originalWindow;
      }

      if (originalPerformance === undefined) {
        delete globals.performance;
      } else {
        globals.performance = originalPerformance;
      }

      if (originalAudio === undefined) {
        delete globals.Audio;
      } else {
        globals.Audio = originalAudio;
      }
    };

    return { module, plays, advance, cleanup };
  };

  test("throttles repeated plays of the same sound for 400ms", () => {
    const { module, plays, advance, cleanup } = setupEnvironment();

    try {
      module.playSoundEffect("/audio/sounds/sample.mp3");
      module.playSoundEffect("/audio/sounds/sample.mp3");
      advance(399);
      module.playSoundEffect("/audio/sounds/sample.mp3");
      advance(1);
      module.playSoundEffect("/audio/sounds/sample.mp3");
    } finally {
      cleanup();
    }

    assert.deepStrictEqual(plays, [
      "/audio/sounds/sample.mp3",
      "/audio/sounds/sample.mp3",
    ]);
  });

  test("allows different sound urls to overlap", () => {
    const { module, plays, cleanup } = setupEnvironment();

    try {
      module.playSoundEffect("/audio/sounds/first.mp3");
      module.playSoundEffect("/audio/sounds/second.mp3");
    } finally {
      cleanup();
    }

    assert.deepStrictEqual(plays, [
      "/audio/sounds/first.mp3",
      "/audio/sounds/second.mp3",
    ]);
  });

  test("normalizes relative urls before throttling", () => {
    const { module, plays, cleanup } = setupEnvironment();

    try {
      module.playSoundEffect("audio/sounds/third.mp3");
      module.playSoundEffect("/audio/sounds/third.mp3");
    } finally {
      cleanup();
    }

    assert.deepStrictEqual(plays, ["/audio/sounds/third.mp3"]);
  });

  test("applies a music volume multiplier when syncing music", () => {
    const { module, cleanup } = setupEnvironment();

    try {
      module.initialize();
      module.applySettings({ masterVolume: 1, musicVolume: 1 });

      const musicElement = (
        module as unknown as { musicElement: { volume: number } | null }
      ).musicElement;

      assert(musicElement, "music element should be initialized");
      assert.strictEqual(musicElement.volume, 0.3);
    } finally {
      cleanup();
    }
  });
});
