# Product Search GitHub

Параллельная GitHub Pages-оболочка рабочего приложения «Поиск товаров».

Проект рассчитан на полностью бесплатную публикацию: публичный GitHub-репозиторий,
GitHub Pages и Google Apps Script без платных серверов или подписок.

Целевая архитектура:

```text
GitHub Pages (Vite, mobile-first)
        ↓ HTTPS JSON API
отдельный Apps Script backend
        ↓
существующая Google-таблица и связанные файлы Google Drive
```

Production-проект `V12.06` и deployment версии 51 остаются отдельной,
неизменяемой рабочей системой. Первый production-срез нового backend принимает
только GET и не содержит операций записи.

## Локальный запуск

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

В `.env.local` задайте URL нужного backend:

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
- `backend-apps-script/` — изолированный test backend для write/E2E-проверок.
- `backend-production-api/` — отдельный production API; текущая сборка только читает.
- `docs/current-system-audit.md` — read-only аудит версии 51.
- `docs/production-readonly-migration.md` — аудит бизнес-логики и статус реальной миграции.
- `docs/api.md` — контракт API.
- `docs/parity-test-report.md` — матрица функционального соответствия.
- `MIGRATION.md` — условия будущего production-переключения.

## Безопасность

- OAuth-токены, `.clasprc.json`, ключи и credentials исключены из Git.
- Реальные Script/Spreadsheet/Folder/Deployment ID хранятся вне Git.
- В репозитории находится только исходный код backend, но не данные экземпляра Apps Script,
  не содержимое таблицы и не файлы Google Drive.
- Публичный URL backend не считается секретом.
- Production read-only deployment отвергает любой POST с `READ_ONLY`.
- Test-записи проверяют лист, номер строки, неизменяемый `taskToken`, владельца задания и допустимый статус.
- POST-запросы не повторяются автоматически; при timeout frontend проверяет результат
  по тому же `idempotencyKey` через read-only endpoint.
- Fixture cleanup удаляет только файлы из test-папки с защитным префиксом имени.
- Production-подключение требует отдельного подтверждения.
