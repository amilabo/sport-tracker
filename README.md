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

Тема — один файл в `src/styles/themes/` с блоками `[data-theme="…"][data-mode="light|dark"]` и запись в `THEMES` (`src/lib/theme.ts`). `scripts/check-contrast.mjs` проверяет, что у темы есть все токены и ключевые пары проходят WCAG AA.

## PWA и офлайн

После `next build` скрипт `scripts/build-pwa.mjs` пишет в `out/`:
- `manifest.webmanifest` — цвета берутся из токенов темы `card`, пути — с учётом `PAGES_BASE_PATH`;
- `sw.js` — кэширует все файлы сборки при установке и отвечает из кэша (cache first). Версия — хэш содержимого сборки; новая версия скачивается в фоне и включается при следующем запуске приложения.

В `npm run dev` service worker не регистрируется. Иконки — `public/icons/*.png`, исходник `scripts/icons/icon.svg`, пересборка PNG: `node scripts/icons/render.mjs`.

## Копия данных

«Ещё → Копия данных»: весь IndexedDB в одном JSON (`sport-tracker-backup-ГГГГ-ММ-ДД.json`) через Web Share API, иначе скачивание. Восстановление — «Объединить» (новее по `updated_at`) или «Заменить всё». Формат — `src/domain/backup.ts`.
