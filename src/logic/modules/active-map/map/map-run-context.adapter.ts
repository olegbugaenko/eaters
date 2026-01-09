import type { RuntimeContextSource } from "@core/logic/provided/services/gameplay-ports";
import type { MapRunState } from "./MapRunState";

export class MapRunContextAdapter implements RuntimeContextSource {
  constructor(private readonly runState: MapRunState) {}

  public shouldProcessTick(): boolean {
    return this.runState.shouldProcessTick();
  }
}
