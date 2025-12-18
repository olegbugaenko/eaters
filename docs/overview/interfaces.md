# Ключові інтерфейси

Нижче — найуживаніші контракти, на які спираються модулі та сервіси.

## Базові контракти модулів
- `GameModule` (`src/logic/core/types.ts`) — обов’язкові методи кожного модуля: `initialize()`, `reset()`, `load(data)`, `save()`, `tick(deltaMs)`, а також `id`.
- `Tickable` (`src/logic/core/types.ts`) — будь-який об’єкт, що можна оновлювати по таймеру через `tick(deltaMs)`.

## Руйнівні об’єкти
- `DestructubleData` (`src/logic/interfaces/destructuble.ts`) — описує здоров’я, броню, базовий урон, розміри та knockback для об’єктів, які можна зруйнувати (цеглини, юніти ворогів).
- `DestructubleExplosionConfig` (`src/logic/interfaces/destructuble.ts`) — параметри вибуху при отриманні урону чи знищенні: тип, базовий радіус, множник і зсув.

## Типи юнітів
- `PlayerUnitBlueprintStats` (`src/types/player-units.ts`) — повний набір характеристик юніта (здоров’я, атака, крити, швидкості руху та атаки, маса, броня, модифікатори).
- `PlayerUnitBonusLine` (`src/types/player-units.ts`) — формат відображення бонусів (лейбл, значення, тип відображення: flat/percent/multiplier).
- `UnitTargetingMode` та `UnitTargetingSettings` (`src/types/unit-targeting.ts`) — режими таргетингу («nearest», «highestHp», «none» тощо) та дефолтні налаштування для збережень.

## Ресурси та економіка
- `ResourceAmountMap` (`src/types/resources.ts`) — карта ресурсів (`mana`, `sanity` та будь-які розширення), використовується для вартості спелів і апгрейдів.
- `ResourceCost` (`src/types/resources.ts`) — часткові вимоги ресурсів; нормалізуються через `normalizeResourceCost`.
- `BonusEffectMap` та `BonusEffectPreview` (`src/types/bonuses.ts`) — опис формул бонусів і їх попередній перегляд на UI.

## Умови відкриття контенту
- `UnlockCondition` (`src/types/unlocks.ts`) — умова відкриття карти або скіла з прив’язкою до рівня.
- `UnlockConditionList` (`src/types/unlocks.ts`) — список умов, який використовують сервіси розблокування та модулі прогресу.
