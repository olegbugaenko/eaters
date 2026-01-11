import type { SceneFill } from "@core/logic/provided/services/scene-object-manager/scene-object-manager.types";
import { BrickConfig } from "../../../../db/bricks-db";
import { cloneSceneFill } from "@shared/helpers/scene-fill.helper";

export const createBrickFill = (config: BrickConfig): SceneFill => {
  return cloneSceneFill(config.fill);
};
