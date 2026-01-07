# StatusEffectsModule

## Призначення
Уніфікований сервіс для бафів/дебафів на юнітах, ворогах і бріках. Централізує логіку тривалості, стеків, DoT, а також візуальні накладки/аури/тинти.

## Залежності
- `status-effects-db.ts` — конфігурація ефектів (тип, таргет, тривалість, візуал).
- `StatusEffectUnitAdapter`, `StatusEffectBrickAdapter`, `StatusEffectEnemyAdapter` — адаптери для взаємодії з модулями юнітів/бріків/ворогів.

## Життєвий цикл
- `initialize()` — без додаткової логіки.
- `reset()` / `load()` — повністю очищують активні ефекти.

## Основні методи
- `applyEffect(effectId, target, options)` — застосовує ефект до цілі (підтримує параметри з логіки).
- `removeEffect(effectId, target)` — видаляє конкретний ефект.
- `hasEffect(effectId, target)` — перевірка наявності.
- `clearTargetEffects(target)` — очищує всі ефекти цілі.
- `tick(deltaMs)` — оновлює таймери й DoT.
- `consumeAttackBonus(unitId)` — витрачає “заряди” бонусу атаки (Frenzy).
- `getUnitAttackMultiplier(unitId)` — множник атаки з інтенсивністю стеків (Internal Furnace).
- `getBrickIncomingDamageMultiplier(brickId)` / `getBrickOutgoingDamageMultiplier(brickId)` — модифікатори дамагу.
- `getTargetArmorDelta(target)` / `getTargetSpeedMultiplier(target)` — модифікатори броні та швидкості.
- `handleUnitAttack(unitId)` / `handleTargetHit(target)` — подієві хуки для стеків на ударі.

## Візуальні ефекти
Візуал описується в `status-effects-db.ts` через `visuals`:
- `overlay` — накладання кольору на fill/stroke (для юнітів/ворогів).
- `auraEffectId` — інтеграція з `EffectsModule`.
- `brickTint` — тинт для бріків із пріоритетом.

## Збереження
Стан не зберігається — ефекти є похідними від поточного бою.
