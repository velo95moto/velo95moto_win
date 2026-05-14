# Desktop ↔ Site Sync Audit

Дата проверки: 2026-05-13.

## Карта функционала

### Сайт

- Ремонты: список, добавление, редактирование, отметка `Забрал`, уведомление клиента, поиск/фильтры.
- Очередь клиентов: создание, список, поиск клиента, удаление, документ очереди.
- Сборка: дневные итоги, отдельные записи сборок, удаление записи, сборщики.
- Заказы сборок: создание нескольких заказов, срочность, статусы `assembly → in_progress → done`, `out_of_stock`.
- Зарплата/сводки: зарплата мастеров и сборщиков, отчеты, журнал, закрытие месяца.
- Табель: дневной и месячный табель, статусы, аванс, подработка, опоздания, заметки.
- Авансы и долги: выдача аванса, удаление сегодняшнего аванса, выдача/возврат долга.
- Кабинет оператора: пароль оператора.
- Пользователи/роли: создание пользователей, смена роли, смена пароля, удаление.
- Аудит: список действий.
- Магазин: публичный каталог, товары, категории, акции; staff API для desktop.

### Desktop

- Реализованные views: `records`, `add-record`, `records-search`, `assembly`, `assembly-order`, `assembly-orders`, `advances`, `salary`, `daily-timesheet`, `journal`, `timesheet`, `audit`, `operator`, `users`, `shop`.
- Локальная очередь: ремонты, сборки, авансы, заказы сборок. Синхронизация через `sync_records`, `pull_records`, `pull_all_today`.
- Онлайн API через Tauri `api_request`: табель, зарплата, журнал, бухгалтерия, сотрудники, долги, пользователи, аудит, магазин.

### Mobile endpoints, которые использует desktop

- Auth/bootstrap: `mobile/auth/token/`, `mobile/auth/token/refresh/`, `mobile/bootstrap/`, `mobile/auth/verify-operator-password/`.
- Records sync: `mobile/sync/records/`, `mobile/records/<id>/notify/`.
- Assembly: `mobile/assembly/`, `mobile/assembly/entries/`, `mobile/assembly/entries/<id>/`, `mobile/assembly/orders/`.
- Advances/debt/employees: `mobile/advances/`, `mobile/employees/`, `mobile/employees/debt/`, `mobile/employees/create/`, `mobile/employees/<id>/`, `mobile/positions/`.
- Timesheet/salary/summary: `mobile/timesheet/daily/`, `mobile/timesheet/monthly/`, `mobile/salary/`, `mobile/summary/`, `mobile/report/`, `mobile/buhgalteria/`.
- Admin: `mobile/audit-log/`, `mobile/operator-cabinet/`, `mobile/users/`, `mobile/users/<id>/`.
- Shop: `mobile/shop/categories/`, `mobile/shop/categories/<id>/`, `mobile/shop/products/`, `mobile/shop/products/<id>/`.

## Проверенные сценарии

- Сборка офлайн → POST `/mobile/assembly/` → merge дублей дневного `Assembly` → запись `AssemblyEntry` создается один раз.
- Повторный POST сборки с тем же `sync_uuid` не увеличивает сумму повторно.
- Аванс через desktop API идемпотентен по `sync_uuid`.
- Заказ сборки через desktop API идемпотентен по `sync_uuid`.
- Оператор не может создать заказ сборки через mobile API, как и на сайте; оператор может менять статус заказа.
- Мастер не может менять статус заказа сборки через mobile API.
- Конфликт ремонта возвращает `server_has_newer_version` и серверную запись для предсказуемого разрешения в desktop.
- Shop mobile API доступен только staff/superuser; не-staff получает русское `Нет доступа.`.
- Категорию магазина нельзя удалить, если в ней есть товары.
- Desktop sync показывает полный текст ошибки синхронизации вместо короткого `status code: 500`.

## Исправленные баги

- `/mobile/assembly/` падал 500 при нескольких `Assembly` за одну дату и сборщика. Теперь mobile API использует такой же merge дублей, как веб-форма.
- Desktop не сохранял понятную причину ошибки сборки в локальной очереди. Теперь `assemblies.last_error` заполняется, sync возвращает русское сообщение с датой, суммой и сборщиком.
- Ошибка server-side sync больше не переводит приложение в состояние `Нет интернета`.

## Автотесты

Добавлены:

- `records.tests.AssemblySyncApiTests`
- `records.tests.MobileSyncContractTests`
- `shop.tests.ShopMobileApiTests`
- desktop unit test для полного текста ошибки sync indicator.

Команды:

- `npm test` — прошел.
- `cargo check` — прошел, есть старое предупреждение `UpdatedRecord.total_amount is never read`.
- `DJANGO_SETTINGS_MODULE=workshop.settings_local ../venv/bin/python backend/manage.py test records.tests.AssemblySyncApiTests records.tests.MobileSyncContractTests shop.tests.ShopMobileApiTests` — прошел.
- `../venv/bin/python backend/manage.py test ...` без local settings — не запустился из-за отсутствующего PostgreSQL на `/tmp/.s.PGSQL.5432`.
- `DJANGO_SETTINGS_MODULE=workshop.settings_local ../venv/bin/python backend/manage.py test records.tests shop.tests` — запустился, но упал в старых сценариях, см. ниже.

## Найденные риски вне текущего фикса

- `RoleAccessMatrixTests`: часть protected routes возвращает 404 вместо ожидаемых 302/403/200; у viewer есть доступ к добавлению сборки/сборщика и кабинету оператора там, где тест ожидает 403.
- `DailyTimesheetPageTests`: day-off сотрудника не получает дефолтный статус `weekend`.
- `EmployeeArchiveWorkflowTests`: архивный сотрудник отображается в табеле.
- `MonthCloseDebtTests`: перенос отрицательного баланса/повторное закрытие месяца работает не так, как ожидают тесты; redirect идет на `/staff/summary/`, а тест ждёт `summary6`.
- `Summary6PageTests`: после конца месяца не найден текст `Закрыть апрель`.

Эти падения не относятся напрямую к `/mobile/assembly/`, но важны для совместимости сайта и desktop, потому что затрагивают роли, табель и закрытие месяца.

## Что не удалось проверить вручную

- Windows offline/online сценарий в реальном приложении: в текущей среде нет Windows runtime.
- Проверка на production БД: намеренно не выполнялась, чтобы не создавать/не менять реальные записи.
- Одновременная работа двух реальных клиентов сайт+desktop: без отдельного staging/тестового аккаунта это рискованно для production.

## Рекомендации для следующего прохода

- Поднять staging PostgreSQL с копией схемы без персональных production-данных.
- Прогнать Windows build с отдельным оператором и тестовым сервером.
- Исправить обнаруженные failures role/timesheet/month-close отдельными маленькими задачами.
- Добавить e2e smoke: сайт создал действие → desktop pull; desktop создал offline → server sync; повторный sync → без дубля.
