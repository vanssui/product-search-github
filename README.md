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
неизменяемой рабочей системой. Новый backend уже имеет версионированный API v1
и защитный код операций записи, но production deployment работает строго в
режиме чтения.

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
- `backend-production-api/` — отдельный production API и Sheets/Drive adapters.
- `docs/current-system-audit.md` — read-only аудит версии 51.
- `docs/production-readonly-migration.md` — аудит бизнес-логики и статус реальной миграции.
- `docs/architecture.md` — границы и зависимости системы.
- `docs/frontend.md`, `docs/backend.md` — устройство слоёв.
- `docs/api.md` — контракт API.
- `docs/data-contract.md` — публичные DTO и приватный adapter boundary.
- `docs/deployment.md`, `docs/recovery.md`, `docs/extending.md` — эксплуатация.
- `docs/parity-test-report.md` — матрица функционального соответствия.
- `MIGRATION.md` — условия будущего production-переключения.

## Безопасность

- OAuth-токены, `.clasprc.json`, ключи и credentials исключены из Git.
- Реальные Script/Spreadsheet/Folder/Deployment ID хранятся вне Git.
- В репозитории находится только исходный код backend, но не данные экземпляра Apps Script,
  не содержимое таблицы и не файлы Google Drive.
- Публичный URL backend не считается секретом.
- Production API deployment version 10 отвергает любой POST с `READ_ONLY`.
- Публичные DTO не содержат имён листов, номеров строк и Drive file IDs.
- Test-записи проверяют лист, номер строки, неизменяемый `taskToken`, владельца задания и допустимый статус.
- POST-запросы не повторяются автоматически; при timeout frontend проверяет результат
  по тому же `idempotencyKey` через read-only endpoint.
- Fixture cleanup удаляет только файлы из test-папки с защитным префиксом имени.
- Production-подключение требует отдельного подтверждения.
