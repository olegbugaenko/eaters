# Архітектурний огляд

Документація з цього розділу пояснює, як влаштовано ядро гри, сервісний шар і спосіб взаємодії логіки з UI.

## З чого почати

1. Перегляньте розділ «Ядро рантайму», щоб зрозуміти життєвий цикл застосунку та модулів.
2. Ознайомтеся із сервісами — вони постачають карти, зберігання, оновлення сцени й інші спільні функції.
3. Перейдіть до [modules/index.md](../modules/index.md), щоб знайти конкретні API кожного модуля.

## Вміст

- [runtime.md](runtime.md) — ServiceContainer, Application, DataBridge та івент-цикл.
- [services.md](services.md) — SaveManager, GameLoop, SceneObjectManager та допоміжні сервіси.
- [state-factory.md](state-factory.md) — уніфікований підхід до створення станів модулів через StateFactory.
- [interfaces.md](interfaces.md) — ключові інтерфейси для модулів, юнітів, ресурсів та умов відкриття.
- [file-structure.md](file-structure.md) — стислий огляд директорій і точок входу в код.
- [ui-integration.md](ui-integration.md) — як React підписується на логіку та взаємодіє зі сценою.
