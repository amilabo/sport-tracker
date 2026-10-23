# Спорт трекер

Личный дневник силовых тренировок и замеров тела. PWA, работает без интернета, все данные хранятся только на устройстве (IndexedDB). Бэкап — JSON-файл через «Поделиться».

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | локальный сервер разработки, http://localhost:3000 |
| `npm test` | unit-тесты (vitest) |
| `npm run check` | проверка: нет захардкоженных цветов, контраст тем по WCAG AA |
| `npm run build` | статическая сборка в `out/` (перед ней — `check`, после — `scripts/build-pwa.mjs`: manifest и service worker) |
| `npm start` | раздать собранную папку `out/` локально |

Сборка для GitHub Pages: `PAGES_BASE_PATH=/<repo> npm run build` — так делает workflow `.github/workflows/deploy.yml` при push в `main`.

## Цвета и темы

Цвет задаётся только семантическими токенами (`bg-surface`, `text-ink`, `bg-accent`…). Палитра Tailwind по умолчанию отключена, hex/rgb в коде запрещены — это проверяет `scripts/check-colors.mjs`.

Тема — один файл в `src/styles/themes/` с блоками `[data-theme="…"][data-mode="light|dark"]` (импорт в `src/app/globals.css`) и запись в `src/styles/themes/themes.json`: название, акцент по умолчанию, недоступные акценты. Тем семь: `card` (по умолчанию), `midnight`, `air`, `indigo`, `peony`, `lemonade`, `linen`. Если общий оттенок акцента не проходит контраст на теме, в файле темы есть блок `[data-theme][data-accent][data-mode]` с подправленными акцентными токенами.

Акцент — отдельная ось поверх темы: `src/styles/accents.css` с блоками `[data-accent="…"][data-mode="light|dark"]`, которые переопределяют только акцентные токены (`ACCENT_TOKENS`: `accent`, `on-accent`, `accent-text`, `accent-line`, `accent-on-inverse`, `chart-line`). Список — `ACCENTS` в `src/lib/theme.ts`, 9 вариантов, по умолчанию `signal`. Ошибки красятся `danger` / `danger-on-inverse` и от акцента не зависят. Режим, тема и акцент ставятся на `<html>` inline-скриптом до отрисовки (`localStorage`) и хранятся в настройках — попадают в копию.

`scripts/check-contrast.mjs` проверяет, что у темы есть все токены и ключевые пары проходят WCAG AA для каждой комбинации «тема × режим × акцент».

## Документация

Требования, план сборки, заметки о выпусках и лог решений лежат рядом с проектом, вне этого репозитория (в нём только код и демо-данные).

## PWA и офлайн

После `next build` скрипт `scripts/build-pwa.mjs` пишет в `out/`:
- `manifest.webmanifest` — цвета берутся из токенов темы `card`, пути — с учётом `PAGES_BASE_PATH`;
- `sw.js` — кэширует все файлы сборки при установке и отвечает из кэша (cache first). Версия — хэш содержимого сборки; новая версия скачивается в фоне и включается при следующем запуске приложения.

В `npm run dev` service worker не регистрируется. Иконки — `public/icons/*.png`, исходник `scripts/icons/icon.svg`, пересборка PNG: `node scripts/icons/render.mjs`.

## Копия данных

«Ещё → Копия данных»: весь IndexedDB в одном JSON (`sport-tracker-backup-ГГГГ-ММ-ДД.json`) через Web Share API, иначе скачивание. Восстановление — «Объединить» (новее по `updated_at`) или «Заменить всё». Формат — `src/domain/backup.ts`.
