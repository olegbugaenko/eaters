# StatusEffectsModule

## Призначення
Уніфікований сервіс для бафів/дебафів на юнітах, ворогах і бріках. Централізує логіку тривалості, стеків, DoT, а також візуальні накладки/аури/тинти.

## Залежності
- `status-effects-db.ts` — конфігурація ефектів (тип, таргет, тривалість, візуал, UI-метадані).
- `status-effects-db.helpers.ts` — helper функції для форматування ефектів в UI.
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

## UI-метадані ефектів

Кожен ефект у `status-effects-db.ts` може мати UI-метадані для відображення в тултіпах:

### displayName
Локалізована назва ефекту для UI (наприклад, "Internal Furnace", "Melting Tail").

### descriptionParams
Масив параметрів, які відображаються в тултіпі. Підтримувані типи:
- `damage` — DPS (damagePerSecond → "X/s")
- `duration` — тривалість (durationMs → "Xs")
- `slowdown` — уповільнення (speedMultiplier → "X%")
- `stacks` — максимум стеків
- `armorReduction` — зниження броні за стек
- `incomingDamageBonus` — бонус вхідного дамагу (multiplier → "+X%")
- `outgoingDamageReduction` — зниження вихідного дамагу (divisor → "X%")

**Приклад конфігурації:**
```typescript
meltingTail: {
  id: "meltingTail",
  kind: "incomingDamageMultiplier",
  target: "brick",
  displayName: "Melting Tail",
  descriptionParams: [
    { type: "incomingDamageBonus", label: "Damage Bonus" },
    { type: "duration", label: "Duration" },
  ],
  visuals: { ... },
}
```

## Helper функції

### formatEffectApplicationStats(effectId, options)
Форматує параметри ефекту в масив `{ label, value }` для відображення в тултіпах. Використовує `descriptionParams` з конфігу ефекту.

**Приклад використання:**
```typescript
const stats = formatEffectApplicationStats("meltingTail", {
  multiplier: 1.5,
  durationMs: 4000,
});
// Результат: [{ label: "Damage Bonus", value: "+50%" }, { label: "Duration", value: "4s" }]
```
