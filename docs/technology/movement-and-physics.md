# Рух і фізика юнітів

Документ пояснює, як у грі обчислюється рух юнітів, чому бонуси швидкості інколи «не видно» в UI, і де це шукати в коді.

## 1) Базові параметри руху

Для юніта важливі три величини:

- `moveAcceleration` — прискорення;
- `moveSpeed` — верхня межа швидкості (кап);
- `drag` — опір руху (`DRAG_COEFFICIENT * dragMultiplier`).

Під час створення runtime-стану юніта обчислюється:

- `unclampedMaxSpeed = sqrt(moveAcceleration / drag)` (якщо `drag > 0`);
- `effectiveMaxMoveSpeed = min(unclampedMaxSpeed, moveSpeed)`.

Тобто підсумкова швидкість — це мінімум між «фізично досяжною» і «капом».

## 2) Чому буст швидкості може не змінити число в UI

Якщо юніт вперся в `unclampedMaxSpeed` (тобто його обмежує прискорення/drag),
просте збільшення `moveSpeed` (капу) майже не вплине на `effectiveMaxMoveSpeed`.

Навпаки, буст `moveAcceleration` зсуває `unclampedMaxSpeed` вгору й зазвичай помітніший.

## 3) Де це показується в UI

- **Biolab / Unit Designer** показує `realMaxMoveSpeed`, який рахується тією ж формулою `min(sqrt(acceleration / drag), moveSpeed)`.
- **RMB tooltip на мапі** для юніта показує `effectiveMaxMoveSpeed` (або `moveSpeed`, якщо ефективне значення відсутнє).

Через це ефект модуля/скіла може бути в даних, але не завжди очевидний у фінальному числі швидкості.

## 4) Практична діагностика

Якщо підозрюєте, що бонус «не працює»:

1. Перевірте, чи змінився `moveAcceleration` і/або `moveSpeed` у blueprint.
2. Перевірте, чи змінився `effectiveMaxMoveSpeed` у runtime.
3. Порівняйте значення до/після екіпу модуля в bridge payload (`unitDesign` стан).

## 5) Пов’язані модулі

- `UnitDesignModule` — агрегує бонуси модулів у blueprint;
- `UnitFactory` — переводить blueprint у runtime-параметри руху;
- `buildUnitStatEntries` / `createTargetTooltip` — рендерять швидкість у UI.
