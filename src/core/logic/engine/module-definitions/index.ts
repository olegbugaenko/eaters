import { ModuleDefinitionContext } from "./context";
import { ModuleRegistry, ModuleRegistryConfig } from "@/core/logic/engine/ModuleRegistry";
import { sortModuleDefinitions } from "../../../../logic/helpers/module-dependency-sort";

export function createModuleDefinitions(
  context: ModuleDefinitionContext,
  config: ModuleRegistryConfig,
  registerModuleDefinitions: (registry: ModuleRegistry, context: ModuleDefinitionContext) => void,
) {
  const registry = new ModuleRegistry(config);

  registerModuleDefinitions(registry, context);

  return sortModuleDefinitions(registry.getDefinitions());
}
