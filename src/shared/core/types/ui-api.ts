export type UiModuleApi = Record<string, (...args: any[]) => any>;

export type UiApiRegistry = Record<string, UiModuleApi>;

export type UiApiProxy<T> = {
  [K in keyof T]: {
    [M in keyof T[K]]: T[K][M] extends (...args: infer P) => infer R
      ? (...args: P) => R
      : never;
  };
};
