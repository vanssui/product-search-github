# План миграции

## Текущее состояние

Новая система работает только с изолированной тестовой таблицей. Production Script ID
и deployment версии 51 не изменяются и намеренно не публикуются в репозитории.

## Перед production-подключением

1. Зафиксировать успешный test baseline: 100 задач, пустая test Drive-папка,
   отсутствие `CLAIM_*` и `IDEMP_*`.
2. Создать отдельный production Apps Script deployment нового backend; не
   переиспользовать test deployment и не обновлять V12.06/version 51.
3. Установить production Spreadsheet/Drive IDs только в Script Properties нового
   production backend после отдельного подтверждения владельца.
4. Установить `APP_CONFIG.environment = production` и удалить `TestSetup.gs` из
   production-сборки, чтобы fixture cleanup физически отсутствовал.
5. Выполнить read-only smoke test нового production backend: `health`,
   `getTasks`, схема листов, число задач и CORS. Записи ещё не выполнять.
6. Провести одну согласованную тестовую запись на заранее выбранной production-строке,
   затем проверить таблицу и Drive вручную.
7. Выпустить immutable production-версию нового backend и сохранить её Deployment ID.
8. Создать отдельное GitHub environment `production` с требованием ручного
   подтверждения deployment.
9. Заменить `VITE_BACKEND_URL` только после явной команды владельца и сохранить
   предыдущий test Pages artifact для быстрого отката.
10. Провести ограниченный пилот, сохраняя рабочий URL V12.06/version 51 без изменений.
11. Сравнить ошибки и время ответа, затем расширять аудиторию поэтапно.
12. Старые deployment архивировать только отдельной командой после подтверждённого
    отсутствия обращений; это не входит в переключение Pages.

## Что изменится при переключении

- В отдельной production-сборке `APP_CONFIG.environment` станет `production`.
- `APP_CONFIG.spreadsheetId` и `APP_CONFIG.photoFolderId` будут заменены после подтверждения.
- `TestSetup.gs` не войдёт в production-сборку.
- GitHub repository variable `VITE_BACKEND_URL` будет указывать на утверждённое deployment нового backend.

Ни один из этих шагов не требует обновления или архивирования deployment версии 51.
