import { GameLoop } from "@core/logic/provided/services/game-loop/GameLoop";
import { MapRunState } from "../../../../logic/modules/active-map/map/MapRunState";
import { MovementService } from "@core/logic/provided/services/movement/MovementService";
import { SaveManager } from "@core/logic/provided/services/save-manager/SaveManager";
import { SceneObjectManager } from "@core/logic/provided/services/scene-object-manager/SceneObjectManager";
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
    { token: "movement", factory: (container) => new MovementService(container.get("sceneObjects")) },
    { token: "mapRunState", factory: () => new MapRunState() },
  ] as const;
}
