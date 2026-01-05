import { GameLoop } from "../../services/game-loop/GameLoop";
import { MapRunState } from "../../modules/active-map/map/MapRunState";
import { MovementService } from "../../services/movement/MovementService";
import { SaveManager } from "../../services/save-manager/SaveManager";
import { SceneObjectManager } from "../../services/scene-object-manager/SceneObjectManager";
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
