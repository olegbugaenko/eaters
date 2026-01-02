import { GameLoop } from "../../services/GameLoop";
import { MapRunState } from "../../modules/map/MapRunState";
import { MovementService } from "../../services/MovementService";
import { SaveManager } from "../../services/SaveManager";
import { SceneObjectManager } from "../../services/SceneObjectManager";
import { ServiceDefinition } from "./types";

export function createBootstrapDefinitions(): ServiceDefinition<unknown>[] {
  return [
    { token: "saveManager", factory: () => new SaveManager() },
    { token: "gameLoop", factory: () => new GameLoop() },
    { token: "sceneObjects", factory: () => new SceneObjectManager() },
    { token: "movement", factory: () => new MovementService() },
    { token: "mapRunState", factory: () => new MapRunState() },
  ];
}
