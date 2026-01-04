# Agents

## Global guidelines

### Technology stack
React, Typescript, WebGL

### General file structure
src/ - source files of the project
- logic/ - app logic. Working with saving, loading, calculations and updating game state
-- core/ - basic abstract classes and system classes
-- modules/ - classes implementing specific logic
---- {group-name} - modules are groupped by scope
------ {module-name} - folder with module files
-------- {module-name}.ts - main logic of the module
-------- {module-name}.const.ts - constants
-------- {module-name}.types.ts - types and interfaces
-------- {module-name}.helpers.ts - module helpers
-- helpers/ - contain files with application-wide, shared between modules and services helpers

- ui/ - react components and webgl shaders for drawing scene
-- shared/ - shared components
-- screens/ - screen specific components, each screen in separate sub-folder

### Code style gidelines
Use prettier
Use types
Use shared styles and components as much as possible.
UI should not work directly with logic, as well as logic with UI. We need to build and utilize interaction standart

### How to approach tasks
1. Locate and read documentation with explanations on file structure (especially docs/overview/*.md files)
2. Before creating new methods - search in logic/helpers for existing or similar ones
3. Avoid code duplication
4. After task complete - run tests
5. Update docs if needed

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
