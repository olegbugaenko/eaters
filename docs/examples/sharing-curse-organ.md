# Приклад: орган із проком Sharing Curse

Нижче покроковий рецепт, як додати орган (модуль), який **при атаці дає 10% шанс накласти Sharing Curse на ціль**. Ефект триває **4 отриманих удари** і під час цих ударів **атакуючий відхілюється на X% від нанесеного дамагу** (X задається в модулі).

> Це інструкція, **не реалізація**. Всі кроки спираються на поточну структуру модулів і нову систему `StatusEffectsModule`.

## 1. Додайте модуль “Sharing Curse Organ” у БД модулів
**Файл:** `src/db/unit-modules-db.ts`

1. Створіть новий `UnitModuleId`, наприклад `sharingCurseOrgan`.
2. Додайте опис модуля в `UNIT_MODULES_DB` з новими метаданими:
   - `meta.procChance` (0.1 для 10%)
   - `meta.sharePercent` (наприклад 0.1 для 10% вампіру)
   - `meta.hits` (4 удари)
3. За потреби додайте іконку, ресурси, unlock і балансні параметри.

**Підказка:** орієнтуйтесь на формат інших органів (наприклад `frenzyGland`, `fireballOrgan`).

---

## 2. Додайте новий ефект у `status-effects-db`
**Файл:** `src/db/status-effects-db.ts`

1. Розширте `StatusEffectId` (наприклад `sharingCurse`).
2. Додайте новий `StatusEffectKind`, наприклад:
   - `sharingCurseCharges`
3. Додайте конфіг у `STATUS_EFFECTS_DB`:
   - `target: "any"` (щоб працювало для бріків/ворогів/юнітів)
   - `maxStacks` або окреме поле для кількості ударів (передається через options)
   - `visuals.overlay` (якщо потрібен візуал на цілі)

---

## 3. Розширте типи опцій для статус-ефектів
**Файл:** `src/logic/modules/active-map/status-effects/status-effects.types.ts`

1. Додайте в `StatusEffectApplicationOptions` поля:
   - `hits?: number` — скільки ударів тримається ефект
   - `sharePercent?: number` — який % дамагу конвертується у heal

---

## 4. Додайте нову логіку у `StatusEffectsModule`
**Файл:** `src/logic/modules/active-map/status-effects/status-effects.module.ts`

1. У `resolveInstance(...)` додайте обробку `sharingCurseCharges`:
   - зберігайте `hits` як `instance.data.hits`
   - зберігайте `sharePercent` як `instance.data.sharePercent`
2. Додайте новий API-метод:
   - `applySharingCurseOnHit(target, source, damage)`
3. У цьому методі:
   - перевіряйте, чи на `target` активний `sharingCurse`
   - якщо так — зменшуйте лічильник ударів
   - обчислюйте heal: `damage * sharePercent`
   - викликайте `unitAdapter.damageUnit(sourceId, -heal)` **або** окремий метод `healUnit` (якщо є)

> Якщо direct heal відсутній — додайте метод `healUnit` у адаптер, але збережіть консистентність з логікою відновлення HP.

---

## 5. Вставте прок у атакуючу логіку юніта
**Файл:** `src/logic/modules/active-map/player-units/units/UnitRuntimeController.ts`

1. Знайдіть `performAttack(...)` (там, де обчислюється `inflictedDamage`).
2. Якщо `inflictedDamage > 0`:
   - витягніть рівень модуля `sharingCurseOrgan`
   - зчитайте `procChance`, `sharePercent`, `hits` із `getUnitModuleConfig(...)`
   - киньте RNG і при успіху:
     ```ts
     statusEffects.applyEffect("sharingCurse", { type: targetType, id: target.id }, {
       hits,
       sharePercent,
       sourceId: unit.id,
     });
     ```
3. При наступних ударах по цілі викликайте:
   ```ts
   statusEffects.applySharingCurseOnHit(
     { type: targetType, id: target.id },
     { type: "unit", id: unit.id },
     inflictedDamage,
   );
   ```

---

## 6. Підтримайте прокляття при дамазі з інших джерел
**Файли:**  
- `src/logic/modules/active-map/bricks/bricks.module.ts`  
- `src/logic/modules/active-map/enemies/enemies.module.ts`

1. У `applyDamage(...)` додайте опційний параметр `source`:
   ```ts
   source?: { type: "unit" | "enemy"; id: string }
   ```
2. Пропускайте його у всі місця, де юніти напряму б’ють цілі.
3. Після `inflictedDamage > 0`:
   - викликайте `statusEffects.applySharingCurseOnHit(target, source, inflictedDamage)`

---

## 7. (Опційно) Візуал
**Файли:**  
`status-effects-db.ts`, `effects-db.ts`, `VisualEffectState`

1. Додайте `visuals.overlay` з відтінком/інтенсивністю.
2. Або створіть aura-рендерер у `effects-db.ts` і підключіть `visuals.auraEffectId`.

---

## 8. Перевірка
1. Додайте тимчасовий лог у `StatusEffectsModule.applySharingCurseOnHit`.
2. Переконайтесь, що лічильник ударів зменшується та heal застосовується.
3. Перевірте, що ефект зникає після 4 ударів.
