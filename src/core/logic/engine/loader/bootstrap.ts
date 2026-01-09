import { GameLoop } from "../../../../logic/services/game-loop/GameLoop";
import { MapRunState } from "../../../../logic/modules/active-map/map/MapRunState";
import { MovementService } from "../../../../logic/services/movement/MovementService";
import { SaveManager } from "../../../../logic/services/save-manager/SaveManager";
import { SceneObjectManager } from "../../../../logic/services/scene-object-manager/SceneObjectManager";
import { ServiceDefinition } from "./types";

export type BootstrapDefinitionList = readonly [
  ServiceDefinition<SaveManager, "saveManager">,
  ServiceDefinition<GameLoop, "gameLoop">,
  ServiceDefinition<SceneObjectManager, "sceneObjects">,
  ServiceDefinition<MovementService, "movement">,
  ServiceDefinition<MapRunState, "mapRunState">,
];

export function createBootstrapDefinitions(): BootstrapDefinitionList {
  return [
    { token: "saveManager", factory: () => new SaveManager() },
    { token: "gameLoop", factory: () => new GameLoop() },
    { token: "sceneObjects", factory: () => new SceneObjectManager() },
    { token: "movement", factory: () => new MovementService() },
    { token: "mapRunState", factory: () => new MapRunState() },
  ] as const;
}
