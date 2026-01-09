import type { UiApiProxy, UiModuleApi } from "@shared/core/types/ui-api";
import type { LogicUiApiRegistry } from "@/logic/core/ui/ui-api.registry";

type UiApiImplementations<T> = {
  [K in keyof T]: T[K];
};

const createModuleProxy = <TModule>(
  moduleName: string,
  moduleApi: TModule,
): TModule => {
  if (!moduleApi || typeof moduleApi !== "object") {
    throw new Error(`UI API module "${moduleName}" must be an object`);
  }
  return new Proxy(moduleApi as object, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return undefined;
      }
      if (!(prop in target)) {
        throw new Error(`UI API method "${String(prop)}" is not available on "${moduleName}"`);
      }
      const value = Reflect.get(target, prop, receiver) as UiModuleApi[keyof UiModuleApi];
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => value.apply(target, args);
    },
  }) as TModule;
};

export const createUiApiProxy = <T>(
  modules: UiApiImplementations<T>
): UiApiProxy<T> => {
  const proxyEntries = Object.entries(modules as Record<string, unknown>).map(
    ([moduleName, moduleApi]) => [
    moduleName,
    createModuleProxy(moduleName, moduleApi),
  ]);
  return Object.fromEntries(proxyEntries) as UiApiProxy<T>;
};

export class UiApiProvider {
  public readonly api: UiApiProxy<LogicUiApiRegistry>;

  constructor(modules: UiApiImplementations<LogicUiApiRegistry>) {
    this.api = createUiApiProxy(modules);
  }
}
