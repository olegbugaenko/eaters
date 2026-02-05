# Система кольорів, fill-типи та версіонування даних

Цей документ описує як працюють кольори й заливки (`SceneColor`, `SceneFill`) у сцені, які хелпери існують для безпечної роботи з ними, і як влаштоване версіонування для змінних payloads у рендер-ланцюжку.

## Базові типи кольорів і заливок

Усі кольори рендера описуються через `SceneColor` (RGBA у діапазоні 0..1) і типи заливок `SceneFill`:

- `SceneColor` — структура `{ r, g, b, a? }`, де `a` опціональний.  
- `SceneFill` — об’єднаний тип із варіантами:
  - `SOLID` — один колір.
  - `LINEAR_GRADIENT`, `RADIAL_GRADIENT`, `DIAMOND_GRADIENT` — градієнти зі списком стопів.
  - `SPRITE` — заповнення через текстуру, з optional tint‑кольором.
- Додаткові компоненти `SceneFill` (noise/filaments/crackMask) дозволяють керувати візуальними ефектами заливки.  

Типи і константи живуть у `scene-object-manager.types.ts` та `scene-object-manager.const.ts`.【F:src/core/logic/provided/services/scene-object-manager/scene-object-manager.types.ts†L1-L110】【F:src/core/logic/provided/services/scene-object-manager/scene-object-manager.const.ts†L1-L33】

## Санітизація і безпечна робота з кольорами

Щоб уникнути некоректних значень, логіка сцени використовує санітизацію кольорів і заливок:

- `sanitizeColor` / `sanitizeSceneColor` — клампінг каналів до 0..1 та підстановка дефолтів.  
- `sanitizeFill` / `sanitizeStroke` — нормалізація заливок і обводок (включно з дефолтами).  
- `SceneObjectManager` при `addObject`/`updateObject` автоматично:
  - санітизує заливку;
  - витягує базовий колір із fill або бере явний `color`;
  - зберігає нормалізовані дані для рендера.  

Це гарантує, що рендер завжди отримує валідні RGBA‑значення і стандартні структури заливки.【F:src/shared/helpers/scene-color.helper.ts†L1-L125】【F:src/core/logic/provided/services/scene-object-manager/scene-object-manager.helpers.ts†L1-L120】【F:src/core/logic/provided/services/scene-object-manager/SceneObjectManager.ts†L52-L146】

## Хелпери для клонування та тінту

У спільних хелперах є набір утиліт, які допомагають уникати мутацій об’єктів:

- `cloneSceneColor`, `cloneColorWithAlpha` — копіювання кольору з коректним alpha.
- `sceneColorsEqual` — порівняння з допуском (для кешів/оновлень).
- `cloneSceneFill`, `cloneSceneFillWithNoiseAndFilaments`, `cloneFillWithOptions` — безпечне копіювання заливок із шумом/філаментами.
- `tintSceneColor` / `tintSceneFill` — тінтування без ручного проходу по stop‑масивах.  

Рекомендація: уникайте мутацій `SceneColor`/`SceneFill` «на місці» — завжди створюйте нові копії через ці утиліти, щоб кеші й рендерери коректно відстежували зміни.【F:src/shared/helpers/scene-color.helper.ts†L1-L125】【F:src/shared/helpers/scene-fill.helper.ts†L1-L220】

### Рекомендований entrypoint

Використовуйте `@shared/helpers/scene-style.helper` як єдину точку входу для sanitize/clone/tint-утиліт. Цей фасад ре-експортує канонічні функції й гарантує єдині правила клампінгу та роботи з alpha‑каналом у всіх модулях.【F:src/shared/helpers/scene-style.helper.ts†L1-L18】

## Версіонування змінних payloads

Для важких/змінних payloads (наприклад, `customData`) SceneObjectManager використовує версійований кеш:

- `CustomDataCacheEntry` зберігає `version` і `snapshotVersion`.
- При зміні даних `version` інкрементується, snapshot перестворюється лише якщо версія змінилася.

Цей підхід дає стабільні snapshots без зайвих глибоких копій при кожному кадрі.  
Якщо ви додаєте власні структури в `customData` чи інші підвантажувані payloads, дотримуйтеся принципу «створити новий об’єкт для нової версії» — це допомагає системі виявляти зміни й уникати зайвого копіювання.【F:src/core/logic/provided/services/scene-object-manager/scene-object-manager.types.ts†L96-L112】【F:src/core/logic/provided/services/scene-object-manager/SceneObjectManager.ts†L487-L610】
