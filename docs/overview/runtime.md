# Ядро рантайму

## ServiceContainer
Легковаговий реєстр сінглтонів. Приймає `ServiceDefinition` із фабрикою, токеном і необов'язковими хуками (`registerAsModule`, `onReady`). Дублікати блокуються методом `register`, а фабрики отримують сам контейнер для lazy-ініціалізації залежностей.

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
- `restartCurrentMap()`, `pauseCurrentMap()`, `resumeCurrentMap()`, `leaveCurrentMap()` — обгортають виклики карти через сервісний проксі.
- `applyAudioSettings(settings)` та `playCampPlaylist()` / `playMapPlaylist()` — делегують аудіо-сервісу.

Модулі потрапляють до `SaveManager` і `GameLoop` автоматично, якщо у визначенні вказано `registerAsModule: true`. Будь-які пост-ініціалізаційні кроки виконуються через `onReady`, що дозволяє модульним фабрикам під'єднати внутрішні колбеки (наприклад, реєстрацію карт чи очищення GPU кешів) без редагування `Application`.

## DataBridge
Транспорт для реактивних даних між логікою та React. Модулі публікують значення через `setValue(key, value)`. Компоненти підписуються за допомогою `subscribe` й отримують початковий стан через `getValue`. Під капотом використовується `useSyncExternalStore`, тож оновлення безпечні для Concurrent Mode.
