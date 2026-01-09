import { ServiceContainer } from "../ServiceContainer";

type BivariantCallback<Args extends any[], Return> = {
  bivarianceHack(...args: Args): Return;
}["bivarianceHack"];

export interface ServiceDefinition<
  TInstance,
  TToken extends string = string,
  TServices extends Record<string, any> = Record<string, any>,
> {
  token: TToken;
  factory: (container: ServiceContainer<TServices>) => TInstance;
  dependsOn?: readonly string[];
  registerAsModule?: boolean;
  onReady?: BivariantCallback<[instance: TInstance, container: ServiceContainer<TServices>], void>;
}

export type ServiceDefinitionList = readonly ServiceDefinition<any, string, any>[];

export type ServiceLookup<Definitions extends readonly ServiceDefinition<any, string, any>[]> = {
  [Definition in Definitions[number] as Definition["token"]]: Definition extends ServiceDefinition<
    infer Instance,
    string
  >
    ? Instance
    : never;
};
