import { ServiceContainer } from "../ServiceContainer";

export interface ServiceDefinition<T> {
  token: string;
  factory: (container: ServiceContainer) => T;
  registerAsModule?: boolean;
  onReady?: (instance: T, container: ServiceContainer) => void;
}
