# Product Search GitHub

Параллельная тестовая версия приложения «Поиск товаров».

Проект рассчитан на полностью бесплатную публикацию: публичный GitHub-репозиторий,
GitHub Pages и Google Apps Script без платных серверов или подписок.

Архитектура:

```text
GitHub Pages (Vite, mobile-first)
        ↓ HTTPS JSON API
отдельный Apps Script backend
        ↓
изолированная тестовая Google-таблица и тестовая папка Google Drive
```

Production-проект `V12.06`, его Script ID и deployment версии 51 не используются для разработки и не изменяются.

## Локальный запуск

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

В `.env.local` задайте URL тестового backend:

```dotenv
VITE_BACKEND_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

## Проверки

```bash
cd frontend
npm test
npm run build
```

## Структура

- `frontend/` — самостоятельный GitHub Pages UI без `google.script.run`.
- `backend-apps-script/` — отдельный Apps Script JSON API.
- `docs/current-system-audit.md` — read-only аудит версии 51.
- `docs/api.md` — контракт API.
- `docs/parity-test-report.md` — матрица функционального соответствия.
- `MIGRATION.md` — условия будущего production-переключения.

## Безопасность

- OAuth-токены, `.clasprc.json`, ключи и credentials исключены из Git.
- Реальные Script/Spreadsheet/Folder/Deployment ID хранятся вне Git.
- В репозитории находится только исходный код backend, но не данные экземпляра Apps Script,
  не содержимое таблицы и не файлы Google Drive.
- Публичный URL backend не считается секретом.
- Все записи проверяют лист, номер строки, неизменяемый `taskToken`, владельца задания и допустимый статус.
- POST-запросы не повторяются автоматически.
- Production-подключение требует отдельного подтверждения.
