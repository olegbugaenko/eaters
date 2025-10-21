# Agents

## Global guidelines

### Technology stack
React, Typescript, WebGL

### General file structure
src/ - source files of the project
- logic/ - app logic. Working with saving, loading, calculations and updating game state
-- core/ - basic abstract classes and system classes
-- modules/ - classes implementing specific logic

- ui/ - react components and webgl shaders for drawing scene
-- shared/ - shared components
-- screens/ - screen specific components, each screen in separate sub-folder

### Code style gidelines
Use prettier
Use types
Use shared styles and components as much as possible.
UI should not work directly with logic, as well as logic with UI. We need to build and utilize interaction standart

## Documentation
- Основна точка входу — `docs/index.md`. Кожна вкладена папка містить власний `index.md` із коротким описом доступних файлів.
- Архітектурні деталі ядра та сервісів: `docs/overview/` (`runtime.md`, `services.md`, `ui-integration.md`).
- API логічних модулів: `docs/modules/`. Кожен модуль описаний окремим файлом із розділами «Призначення», «Основні методи», «Збереження».
- Ігровий процес очима гравця: `docs/gameplay/` (`loop.md`, `units-and-cards.md`, `crafting-and-progress.md`).
- Технічні нотатки й оптимізації: `docs/technology/` (наприклад, `particle-emitter-optimization.md`).

### Як шукати потрібну інформацію
1. Визначте модуль або систему, з якою працюєте (`BonusesModule`, `MapModule`, тощо).
2. Перейдіть до відповідного файлу у `docs/modules/` та прочитайте розділ «Основні методи».
3. Якщо потрібно зрозуміти життєвий цикл або взаємодію між системами — спочатку перегляньте `docs/overview/`.
4. Для продуктового контексту та UX орієнтуйтеся на `docs/gameplay/`.
