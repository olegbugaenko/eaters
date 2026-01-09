import { ServiceContainer } from "../ServiceContainer";
import { ServiceDefinition, ServiceLookup } from "./types";

export function createServiceLookup<Definitions extends readonly ServiceDefinition<any, string, any>[]>(
  container: ServiceContainer,
  _definitions: Definitions,
): ServiceLookup<Definitions> {
  return new Proxy({} as ServiceLookup<Definitions>, {
    get: (_target, token: string) => container.get(token),
  });
}
