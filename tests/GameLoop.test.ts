import assert from "assert";
import { GameLoop } from "../src/core/logic/provided/services/game-loop/GameLoop";
import type { GameModule } from "../src/core/logic/types";
import { describe, test } from "./testRunner";

describe("GameLoop", () => {
  test("start ignores repeated calls and keeps a single timer", () => {
    const globalAny = globalThis as any;
    const originalWindow = globalAny.window;
    const originalDocument = globalAny.document;
    const originalPerformance = globalAny.performance;

    let now = 0;
    let setIntervalCalls = 0;
    let clearedIntervalId: number | null = null;
    const visibilityHandlers = new Set<() => void>();

    globalAny.performance = {
      now: () => now,
    };
    globalAny.window = {
      setInterval: (_callback: () => void) => {
        setIntervalCalls += 1;
        return setIntervalCalls;
      },
      clearInterval: (id: number) => {
        clearedIntervalId = id;
      },
    };
    globalAny.document = {
      hidden: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.add(handler);
        }
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.delete(handler);
        }
      },
    };

    try {
      const loop = new GameLoop();
      loop.start();
      loop.start();

      assert.strictEqual(setIntervalCalls, 1, "game loop should only create one timer");

      loop.stop();
      assert.strictEqual(clearedIntervalId, 1);
    } finally {
      globalAny.window = originalWindow;
      globalAny.document = originalDocument;
      globalAny.performance = originalPerformance;
    }
  });

  test("registerModule rejects duplicate instances and duplicate ids", () => {
    const loop = new GameLoop();
    const module: GameModule = {
      id: "crafting",
      initialize() {},
      reset() {},
      load() {},
      save() {
        return null;
      },
      tick() {},
    };
    const otherModuleWithSameId: GameModule = {
      id: "crafting",
      initialize() {},
      reset() {},
      load() {},
      save() {
        return null;
      },
      tick() {},
    };

    loop.registerModule(module, "background");

    assert.throws(
      () => loop.registerModule(module, "background"),
      /GameLoop module already registered: crafting/,
    );
    assert.throws(
      () => loop.registerModule(otherModuleWithSameId, "background"),
      /GameLoop module id already registered: crafting/,
    );
  });

  test("simulation pause dispatches only pause-aware ticks", () => {
    const globalAny = globalThis as any;
    const originalWindow = globalAny.window;
    const originalDocument = globalAny.document;
    const originalPerformance = globalAny.performance;

    let now = 0;
    let timerCallback: (() => void) | null = null;
    let clearedIntervalId: number | null = null;
    const visibilityHandlers = new Set<() => void>();

    globalAny.performance = {
      now: () => now,
    };
    globalAny.window = {
      setInterval: (callback: () => void) => {
        timerCallback = callback;
        return 1;
      },
      clearInterval: (id: number) => {
        clearedIntervalId = id;
      },
    };
    globalAny.document = {
      hidden: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.add(handler);
        }
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.delete(handler);
        }
      },
    };

    try {
      const loop = new GameLoop();
      let gameplayTicks = 0;
      let pauseTicks = 0;
      let listenerTicks = 0;

      const module: GameModule = {
        id: "test",
        initialize() {},
        reset() {},
        load() {},
        save() {
          return null;
        },
        tick() {
          gameplayTicks += 1;
        },
        tickInPauseMode(_deltaMs, mode) {
          if (mode === "simulation") {
            pauseTicks += 1;
          }
        },
      };

      loop.registerModule(module);
      loop.addTickListener(() => {
        listenerTicks += 1;
      });

      loop.start();
      if (!timerCallback) {
        throw new Error("game loop should register an interval callback");
      }
      const invokeTick: () => void = timerCallback;

      now = 100;
      invokeTick();
      assert.strictEqual(gameplayTicks, 1);
      assert.strictEqual(pauseTicks, 0);
      assert.strictEqual(listenerTicks, 1);

      loop.setPauseMode("simulation");
      now = 200;
      invokeTick();
      assert.strictEqual(gameplayTicks, 1);
      assert.strictEqual(pauseTicks, 1);
      assert.strictEqual(listenerTicks, 2);

      loop.setPauseMode("full");
      now = 300;
      invokeTick();
      assert.strictEqual(gameplayTicks, 1);
      assert.strictEqual(pauseTicks, 1);
      assert.strictEqual(listenerTicks, 3);

      loop.stop();
      assert.strictEqual(clearedIntervalId, 1);
      assert.strictEqual(visibilityHandlers.size, 0);
      assert.strictEqual(loop.getPauseMode(), "none");
    } finally {
      globalAny.window = originalWindow;
      globalAny.document = originalDocument;
      globalAny.performance = originalPerformance;
    }
  });

  test("pause modes keep crafting and dark research progression alive", () => {
    const globalAny = globalThis as any;
    const originalWindow = globalAny.window;
    const originalDocument = globalAny.document;
    const originalPerformance = globalAny.performance;

    let now = 0;
    let timerCallback: (() => void) | null = null;
    const visibilityHandlers = new Set<() => void>();

    globalAny.performance = {
      now: () => now,
    };
    globalAny.window = {
      setInterval: (callback: () => void) => {
        timerCallback = callback;
        return 1;
      },
      clearInterval: (_id: number) => {},
    };
    globalAny.document = {
      hidden: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.add(handler);
        }
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          visibilityHandlers.delete(handler);
        }
      },
    };

    try {
      const loop = new GameLoop();
      let mapTicks = 0;
      let craftingTicks = 0;
      let darkResearchTicks = 0;

      const mapModule: GameModule = {
        id: "map",
        initialize() {},
        reset() {},
        load() {},
        save() {
          return null;
        },
        tick() {
          mapTicks += 1;
        },
      };

      const craftingModule: GameModule = {
        id: "crafting",
        initialize() {},
        reset() {},
        load() {},
        save() {
          return null;
        },
        tick() {
          craftingTicks += 1;
        },
      };

      const darkResearchModule: GameModule = {
        id: "darkResearch",
        initialize() {},
        reset() {},
        load() {},
        save() {
          return null;
        },
        tick() {
          darkResearchTicks += 1;
        },
      };

      loop.registerModule(mapModule, "mapSimulation");
      loop.registerModule(craftingModule, "background");
      loop.registerModule(darkResearchModule, "background");
      loop.start();

      if (!timerCallback) {
        throw new Error("game loop should register an interval callback");
      }
      const invokeTick: () => void = timerCallback;

      now = 100;
      invokeTick();
      assert.strictEqual(mapTicks, 1);
      assert.strictEqual(craftingTicks, 1);
      assert.strictEqual(darkResearchTicks, 1);

      loop.setPauseMode("full");
      now = 200;
      invokeTick();
      assert.strictEqual(mapTicks, 1, "map simulation should remain paused in full pause mode");
      assert.strictEqual(
        craftingTicks,
        2,
        "crafting should continue ticking while pause popup is open",
      );
      assert.strictEqual(
        darkResearchTicks,
        2,
        "dark research should continue ticking while pause popup is open",
      );

      loop.setPauseMode("simulation");
      now = 300;
      invokeTick();
      assert.strictEqual(
        mapTicks,
        1,
        "map simulation should remain paused while run summary is open",
      );
      assert.strictEqual(
        craftingTicks,
        3,
        "crafting should continue ticking after victory/defeat",
      );
      assert.strictEqual(
        darkResearchTicks,
        3,
        "dark research should continue ticking after victory/defeat",
      );

      loop.stop();
    } finally {
      globalAny.window = originalWindow;
      globalAny.document = originalDocument;
      globalAny.performance = originalPerformance;
    }
  });
});
