import { ModuleDefinitionContext } from "./context";
import { ModuleRegistry, ModuleRegistryConfig } from "../../core/ModuleRegistry";
import { registerModuleDefinitions } from "./registry";
import { sortModuleDefinitions } from "../../helpers/module-dependency-sort";

export function createModuleDefinitions(
  context: ModuleDefinitionContext,
  config: ModuleRegistryConfig,
) {
  const registry = new ModuleRegistry(config);

  registerModuleDefinitions(registry, context);

  return sortModuleDefinitions(registry.getDefinitions());
}
