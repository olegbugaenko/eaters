import type { DamageService } from "../src/logic/modules/active-map/targeting/DamageService";

export const createDamageServiceStub = (
  overrides: Partial<DamageService> = {},
): DamageService =>
  ({
    applyTargetDamage: () => 0,
    applyAreaDamage: () => undefined,
    applyStatusEffectDamage: () => 0,
    ...overrides,
  }) as DamageService;
