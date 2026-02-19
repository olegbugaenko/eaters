# EnemiesModule

## Призначення
Відповідає за життєвий цикл ворогів: спавн, рух, навігацію, атаку, знищення та нагороди. Підтримує різні типи атак (ближній бій, снаряди, вибухи, дуги) та спеціальні механіки (спавнери, щупальця).

## Залежності
- `SceneObjectManager` — керує рендер-об'єктами ворогів.
- `MovementService` — фізика переміщення тіл ворогів.
- `TargetingService` — пошук цілей для атаки.
- `DamageService` — нанесення шкоди юнітам.
- `BonusesModule` — множники нагород з ворогів.
- `ExplosionModule` — спавн вибухів при ближній атаці та інших ефектах.
- `ArcModule` — візуальні дуги для `arcAttack`.
- `StatusEffectsModule` — ефекти статусу на ворогах та цілях.
- `DataBridge` — публікує статистику (`enemies/count`, `enemies/totalHp`).

## Життєвий цикл
- `initialize()` — публікує базову статистику.
- `reset()` — очищує сцену та скидає всіх ворогів.
- `load(data)` — відновлює стан ворогів зі збережених даних.
- `tick(deltaMs)` — оновлює рух, атаку, кулдауни, спавнери.

## Основні методи
- `setEnemies(enemies)` — встановлює набір ворогів (при завантаженні карти).
- `spawnEnemy(data)` — додає одного ворога.
- `applyDamage(enemyId, damage, options)` — наносить шкоду ворогу з урахуванням броні, knockback.
- `destroyEnemy(enemy, rewardMultiplier)` — знищує ворога, видає нагороди, обробляє каскадне знищення.
- `findNearestEnemy(position)` — пошук найближчого ворога.
- `findNearestEnemyForInspection(position)` — пошук для tooltip, віддає перевагу сегментам над тілом.
- `forEachBlockingCollider(position, radius, visitor)` — легковаговий запит колізій для ворогів з `blocksUnits: true`.

## Конфігурація ворогів (EnemyConfig)

### Атака та knockback
Ворог атакує юнітів гравця, коли вони потрапляють у `attackRange + physicalSize + target.physicalSize`.

Пріоритет типу атаки:
1. `arcAttack` — дугова атака (блискавка і т.п.)
2. `explosionAttack` — AoE вибух навколо ворога
3. `projectile` — стрільба снарядами
4. **Instant melee** — якщо нічого з вищевказаного не задано, наносить пряму шкоду цілі

#### Knockback при атаці юнітів
- `knockBackDistance` — відстань, на яку юніт відкидається від ворога після атаки.
- `knockBackSpeed` — швидкість відкидання.
- Напрямок: завжди **від ворога до цілі** (тобто ціль відлітає від ворога).
- Типові значення для звичайних ворогів: `knockBackDistance: 80, knockBackSpeed: 120`.
- Для турелей: `knockBackDistance: 120, knockBackSpeed: 160`.
- Якщо не задано — knockback при атаці відсутній.

#### Knockback ворога при отриманні урону
- `selfKnockBackDistance` — відстань відкидання самого ворога при отриманні урону.
- `selfKnockBackSpeed` — швидкість відкидання.
- За замовчуванням: `6` і `30`.
- Для статичних ворогів (щупальця) встановлюється `0`.

#### Melee hit explosion
- `meleeHitExplosion.type` — тип вибуху при ближній атаці (за замовчуванням `"plasmoid"`).
- `meleeHitExplosion.radius` — радіус вибуху.

### Колізія з юнітами
- `blocksUnits` — якщо `true`, юніти гравця не можуть проходити крізь ворога (circle-circle collision resolution у `UnitRuntimeController.resolveUnitCollisions`).
- `physicalSize` — радіус колізії ворога.

### Каскадне знищення (щупальця)
- `linkedEnemyIds` (у `EnemySpawnData`) — при знищенні ворога автоматично знищуються всі пов'язані вороги (наприклад, зовнішні сегменти щупальця при знищенні внутрішнього).
- `bodyEnemyId`, `tentacleIndex`, `segmentIndex` — зв'язок сегмента з тілом восьминога для візуального оновлення.
- `updateTentacleVisual()` — перераховує масив `aliveSegments` і оновлює `customData` тіла для рендерингу.

## Збереження
Зберігає список ворогів з позицією, HP, кулдаунами, зв'язками щупалець. Стан сцени відновлюється при завантаженні.

## Створення станів
Використовує `EnemyStateFactory` (наслідник `StateFactory`):
- **`create`**: ініціалізує стан з конфігу, створює тіло руху, обчислює характеристики для рівня.
- **`transform`**: додає scene object із renderer, emitter, tentacles у `customData`.
