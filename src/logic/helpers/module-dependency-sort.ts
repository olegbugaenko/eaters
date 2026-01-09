import { ServiceDefinition } from "../core/loader/types";

type ModuleDefinition = ServiceDefinition<unknown, string, any>;

export const sortModuleDefinitions = (
  definitions: readonly ModuleDefinition[],
): ModuleDefinition[] => {
  const byToken = new Map<string, ModuleDefinition>();
  const originalOrder = definitions.map((definition) => definition.token);

  definitions.forEach((definition) => {
    if (byToken.has(definition.token)) {
      throw new Error(`Duplicate module definition token: ${definition.token}`);
    }
    byToken.set(definition.token, definition);
  });

  const edges = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();

  originalOrder.forEach((token) => {
    edges.set(token, new Set());
    indegree.set(token, 0);
  });

  definitions.forEach((definition) => {
    const dependencies = definition.dependsOn ?? [];
    dependencies.forEach((dependency) => {
      if (!byToken.has(dependency)) {
        throw new Error(
          `Unknown module dependency "${dependency}" required by "${definition.token}"`,
        );
      }
      if (dependency === definition.token) {
        throw new Error(`Module "${definition.token}" cannot depend on itself`);
      }

      edges.get(dependency)?.add(definition.token);
      indegree.set(
        definition.token,
        (indegree.get(definition.token) ?? 0) + 1,
      );
    });
  });

  const queue: string[] = originalOrder.filter(
    (token) => (indegree.get(token) ?? 0) === 0,
  );
  const sorted: ModuleDefinition[] = [];

  while (queue.length > 0) {
    const token = queue.shift();
    if (!token) {
      break;
    }
    const definition = byToken.get(token);
    if (!definition) {
      continue;
    }
    sorted.push(definition);
    edges.get(token)?.forEach((dependent) => {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
      }
    });
  }

  if (sorted.length !== definitions.length) {
    const remaining = originalOrder.filter(
      (token) => (indegree.get(token) ?? 0) > 0,
    );
    throw new Error(
      `Module dependency cycle detected: ${remaining.join(", ")}`,
    );
  }

  return sorted;
};
