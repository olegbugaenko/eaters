# Ядро рантайму

## ServiceContainer
Легковаговий реєстр сінглтонів. Зберігає сервіси в `Map<string, unknown>` та надає доступ через `get(token)`. Реєстрація через `register(token, service)` викидає помилку, якщо токен вже зайнятий.

### ServiceDefinition та реєстрація
`ServiceDefinition` містить `token`, `factory` (функцію створення сервісу), та необов'язкові хуки (`registerAsModule`, `onReady`). `Application` викликає `factory` з контейнером для lazy-ініціалізації залежностей, реєструє результат в `ServiceContainer`, а потім викликає `onReady` якщо він визначений.

### Service lookup
`createServiceLookup` будує типізований проксі над `ServiceContainer` на основі списку визначень. Будь-який новий модуль додає свій токен до проксі автоматично — окремі геттери в `Application` більше не потрібні.

## Application
Координує життєвий цикл гри. У конструкторі збирає визначення сервісів: `bridge`, бутстрап (наприклад, `SaveManager`, `GameLoop`, `SceneObjectManager`) і всі модулі з `src/logic/definitions/modules/index.ts`. Вони реєструються в контейнері та стають доступними через `app.services.<token>`.

Ключові методи:

- `initialize()` — послідовно викликає `initialize` на кожному модулі.
- `reset()` — очищує сцену, скидуючи стан модулів, а потім флашить відкладені видалення об'єктів сцени.
- `selectSlot(slot)` — перемикає сейв, перезавантажуючи дані й запускаючи цикл оновлень.
- `returnToMainMenu()` — зберігає поточний слот, зупиняє таймери та очищує сцену.
- `selectMap(mapId)` / `selectMapLevel(mapId, level)` — делегують вибір карти `MapModule`.
- `restartCurrentMap()`, `pauseCurrentMap()`, `resumeCurrentMap()`, `leaveCurrentMap()`, `setAutoRestartEnabled(enabled)` — обгортають виклики карти через сервісний проксі.
- `hasActiveSaveSlot()`, `exportActiveSave()`, `importActiveSave(data)` — робота зі сейвами.
- `applyAudioSettings(settings)`, `resumeAudio()`, `playCampPlaylist()`, `playMapPlaylist()` — делегують аудіо-сервісу.

Модулі потрапляють до `SaveManager` і `GameLoop` автоматично, якщо у визначенні вказано `registerAsModule: true`. Будь-які пост-ініціалізаційні кроки виконуються через `onReady`, що дозволяє модульним фабрикам під'єднати внутрішні колбеки (наприклад, реєстрацію карт чи очищення GPU кешів) без редагування `Application`.

## DataBridge
Транспорт для реактивних даних між логікою та React. Модулі публікують значення через `setValue(key, value)`. Компоненти підписуються за допомогою `subscribe(key, listener)` й отримують початковий стан через `getValue(key)`. 

DataBridge зберігає значення в `Map` та колекцію слухачів. При виклику `setValue` автоматично викликаються всі підписані слухачі. React-хуки (наприклад, `useBridgeValue`) використовують `useSyncExternalStore` для підписки на DataBridge, що робить оновлення безпечними для Concurrent Mode.

## StateFactory
Уніфікований підхід до створення локальних станів модулів. Розділяє чисте створення стану (`create`) від side effects та трансформацій (`transform`), що покращує тестованість та підтримуваність коду. Детальніше див. [state-factory.md](state-factory.md).
