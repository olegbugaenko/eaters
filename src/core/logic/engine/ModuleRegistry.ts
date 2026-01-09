import { ServiceDefinition } from "./loader/types";

export interface ModuleRegistryConfig {
  enabledModules?: readonly string[] | null;
}

type ModuleDefinition = ServiceDefinition<unknown, string, any>;

const isModuleEnabled = (
  config: ModuleRegistryConfig,
  token: string,
): boolean => {
  const { enabledModules } = config;
  if (!enabledModules || enabledModules.length === 0) {
    return true;
  }

  return enabledModules.includes(token);
};

export class ModuleRegistry {
  private definitions: ModuleDefinition[] = [];

  constructor(private config: ModuleRegistryConfig = {}) {}

  public registerModule(definition: ModuleDefinition): void {
    this.definitions.push(definition);
  }

  public registerModules(definitions: readonly ModuleDefinition[]): void {
    definitions.forEach((definition) => this.registerModule(definition));
  }

  public getDefinitions(): readonly ModuleDefinition[] {
    return this.definitions.filter((definition) =>
      isModuleEnabled(this.config, definition.token),
    );
  }
}
