# Тестовая среда

- Тестовая таблица: `Product Search GitHub TEST 2026-07-29`
- Spreadsheet ID: хранится вне репозитория
- Тестовая папка фото: `Product Search GitHub TEST Photos`
- Folder ID: хранится вне репозитория
- Новый standalone Apps Script: `Product Search GitHub Backend`
- Script ID: хранится вне репозитория

Функция `setupTestEnvironment()` доступна только внутри нового проекта и не маршрутизируется через HTTP API. Она:

1. проверяет `environment === "test"`;
2. проверяет префикс названия таблицы;
3. очищает только тестовую копию;
4. создаёт пять source-листов и `APP_API_LOG`;
5. добавляет суммарно 100 синтетических строк со статусом `Поиск`;
6. очищает claims/idempotency только нового backend.

Используются пять source-листов, имена которых передаются через runtime-конфигурацию вне Git. Каждый source-лист получает 20 строк. Заголовки — безопасный общий superset фактической схемы версии 51.
