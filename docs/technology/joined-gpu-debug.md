# Joined GPU debug mode

Цей режим створено для швидкого профайлування GPU‑join шляху (anchor → joined primitives) із масовими інстансами.

## Як увімкнути
1. Запустіть dev server:
   ```bash
   npm start
   ```
2. Відкрийте:
   ```
   http://localhost:3000/?joinedDebug=1
   ```
3. На сцені з’явиться **1024 joined‑елементи** (32×32). У правому верхньому куті буде банер, а в debug‑панелі — метрики.

## Метрики
Debug‑панель показує:
- **Joined GPU**: кількість handles та draw calls.
- **Joined GPU timing**: час рендера (render) і час апдейта anchor‑текстури (upload).
- Додатково: FPS, VBO, particle stats тощо.

## Manual checklist (опційно)
- [ ] Увімкнути `joinedDebug=1`, переконатися що joined‑елементи видимі.
- [ ] Перевірити, що метрики Joined GPU оновлюються.
- [ ] Перемкнути WebGL2 → fallback і перевірити лог попередження.
- [ ] Переконатися, що CPU‑fallback не має візуальних зсувів.
