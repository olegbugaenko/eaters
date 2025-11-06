type Disposer = () => void;

const disposers = new Set<Disposer>();

export const registerHmrCleanup = (fn: Disposer): void => {
  if (typeof fn !== "function") return;
  disposers.add(fn);
};

export const runHmrCleanup = (): void => {
  for (const fn of Array.from(disposers)) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
  disposers.clear();
};


// Vite (import.meta.hot)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (import.meta && import.meta.hot) {
  // Run for this module being replaced
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import.meta.hot.dispose(() => runHmrCleanup());
  // Run before ANY HMR update (module graph changes)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import.meta.hot.on?.('vite:beforeUpdate', () => runHmrCleanup());
  // Run before full reloads too
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  import.meta.hot.on?.('vite:beforeFullReload', () => runHmrCleanup());
}

// Webpack fallback (module.hot)
declare const module: any;
if (typeof module !== "undefined" && module && module.hot) {
  if (typeof module.hot.dispose === "function") {
    module.hot.dispose(() => runHmrCleanup());
  }
  if (typeof module.hot.addStatusHandler === "function") {
    try {
      module.hot.addStatusHandler((status: string) => {
        if (status === 'check' || status === 'prepare') {
          runHmrCleanup();
        }
      });
    } catch {}
  }
}


