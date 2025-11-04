import { clearPetalAuraInstances } from "./primitives/PetalAuraGpuRenderer";
import { clearAllAuraSlots as clearPlayerAuraSlots } from "./objects/PlayerUnitObjectRenderer";

export const resetPetalAuraRenderState = (): void => {
  clearPlayerAuraSlots();
  clearPetalAuraInstances();
};
