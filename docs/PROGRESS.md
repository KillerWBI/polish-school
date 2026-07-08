# Прогресс разработки — Backend

## Легенда
- ✅ Готово
- 🔴 Критическая проблема
- 🟡 Есть, но с проблемой

---

## Инфраструктура ✅

| Задача | Статус |
|--------|--------|
| Express 5 + Sequelize 6 + PostgreSQL | ✅ |
| JWT auth + bcrypt | ✅ |
| CORS по `CLIENT_URL`, rate limit `/auth/login` | ✅ |
| `sync({ alter: true })` только в development | ✅ |
| sequelize-cli + начальная миграция | ✅ 2026-05-20 |
| `npm run db:migrate` / `db:migrate:undo` | ✅ 2026-05-20 |
| Пагинация `?page=&limit=` на всех `getAll` | ✅ 2026-05-20 |
| 401 → CustomEvent → AuthContext (фронт) | ✅ 2026-05-20 |
| **`helmet`** (CSP/HSTS/X-Frame-Options) | ✅ 2026-05-21 |
| **JSON body limit 256kb** | ✅ 2026-05-21 |
| **Rate-limit на `/auth/register*`** (5/15мин) | ✅ 2026-05-21 |
| **Env validation при старте** (`JWT_SECRET`, `DB_URL`) | ✅ 2026-05-21 |

---

## Модули

| Модуль | Статус | Нерешённые проблемы |
|--------|--------|---------------------|
| Auth | ✅ | — |
| Users | ✅ | — |
| Groups | ✅ | Запутанная WHERE логика в `lesson.getAll` (работает) |
| Lessons | ✅ | — |
| Individual Courses | ✅ | — |
| Individual Lessons | ✅ | — |
| Homework | ✅ | Multi-tenancy дыры закрыты 2026-05-31 (#1-#3). Zod-валидация подключена (референс-модуль) |
| Attendance | ✅ | Dual confirmation: `pending_student → confirmed/disputed`. Авто-confirm через 3 дня. Migration `20260609000001` нужна на сервере (`npm run db:migrate`). Полное описание → [ATTENDANCE-CONFIRMATION.md](ATTENDANCE-CONFIRMATION.md) |
| Payments | ✅ | **Переписан на live-долг (2026-06-22):** помесячная `Payment` удалена; долг = посещения (`charged`) − `PaymentRecord` (`paid`). Эндпоинты: `GET /payments/debt` (студент), `GET /payments/debts` (учитель), `POST /payments/record`. N+1 в долге по ученикам остаётся (цикл) — оптимизация позже. **2026-07-06:** `PaymentRecord` получил `method` (cash/card/transfer/online) + `source` (manual/online), миграция `20260707000001`; `record` принимает `method` (source='manual'); новый `GET /payments/history` (фильтры studentId/method/from/to + сводка byMethod) |
| Invitations | ✅ (бэк) | C3 механика B (2026-06-28): приглашение учитель→ученик в группу. `GET /users/search`, `POST /groups/:id/invitations`, `GET /invitations`, `PATCH /invitations/:id`. Гейт `TeacherStudent` параллельно. Фронт Ф5–Ф6 в работе |

---

## Задачи

### 🔴 СРОЧНО — Sprint 0 SECURITY FIX (найдено 2026-05-27)

Блокер для публичного запуска. До этих фиксов нельзя пускать второго учителя в платформу.

- [x] **#1 `homework.getAll`** — ✅ 2026-05-31 `collectAccessibleLessonIds(user)`, обе роли фильтруются по своим урокам
- [x] **#2 `homework.submit`** — ✅ 2026-05-31 `studentCanAccessHw()` перед созданием сдачи → 403
- [x] **#3 `homework.getOne`** — ✅ 2026-05-31 owner (учитель) / membership (студент)
- [x] **#4 `payment.getAll`** — ✅ 2026-05-31 `getTeacherStudentIds()` → `studentId IN (свои)`
- [x] **#5** Убрать gender-heuristic в `dashboard.controller` — ✅ 2026-05-31 (заменён `endsWith('а')` на нейтральное `сдал(а)`/`оплатил(а)`, TASK-1)
- [x] **#6** Валидация `deadline >= now` в `homework.create` — ✅ 2026-05-31 (`isNaN(getTime())` ловит битую дату + `deadlineDate < new Date()` ловит прошлое)
- [x] **#7** Валидация `month` (не future) в `payment.calculate` — ✅ 2026-06-02 (TASK-2, сравнение строк `YYYY-MM`)
- [x] **#8** N+1 в `payment.calculate` — ✅ TASK-7 групповая часть (2026-06-08). Индивидуальная — B2 в бэклоге

### ✅ Ревью-3 (2026-06-09) — BUG-1..BUG-8 все закрыты

- [x] **BUG-1** `endDate` timezone fix — `Date.UTC(year, mon, 0)` вместо `new Date(year, mon, 0)` в `payment.controller`, `dashboard.controller` (×2), `attendance.controller`
- [x] **BUG-3** `gradeSubmission` — grade reset: `grade: null` → `status: 'pending'`; схема расширена `z.union([z.number(), z.null()])`
- [x] **BUG-4** Rate-limit на `/auth/verify-email` + `/auth/resend-verification` (10/15мин) добавлен в `app.js`
- [x] **BUG-5** Timing-safe login — dummy bcrypt.compare при отсутствии юзера → защита от timing-attack email enumeration
- [x] **BUG-6** `lesson.getOne` — добавлена ownership-проверка для teacher-роли (раньше только студент проверялся)
- [x] **BUG-7** `gradeSubmission` — проверка `sub.homeworkId === hw.id` (нельзя грейдить сдачу с другого ДЗ)
- [x] **BUG-8** `updatePaymentSchema` — `paid` теперь обязательный, не `.optional()` (был silent no-op)

### ✅ Выполнено
- [x] `homework.create/update/delete` — ownership check
- [x] `homework.getSubmissions/gradeSubmission` — ownership check + include User
- [x] `attendance.create/update` — ownership check
- [x] `group.addStudent/removeStudent/getOne/generateLessons` — ownership check
- [x] `individualCourse.getOne/generateLessons` — ownership check
- [x] `auth.registerTeacher` — `password.length < 6`
- [x] **Транзакция в `group.remove`** — каскадное удаление всех связанных таблиц теперь atomic (2026-05-21)
- [x] **Транзакция в `payment.calculate`** — upsert каждой Payment-записи в одной транзакции (2026-05-21)
- [x] **`payment.update` ownership** — теперь работает для студентов «только индивидуальные курсы» (fallback через `IndividualCourse`) (2026-05-21)
- [x] **`attendance.create`** — delete-then-insert в транзакции, fix конфликта `ON CONFLICT (id)` vs unique `(lessonId, studentId)` (2026-05-21)
- [x] **`attendance.getAll`** — Lesson include с `topic` + `Group.name`, добавлен `IndividualLesson` include с `student` (2026-05-21)
- [x] **`individualLesson.getAll`** — поддержка фильтра `?individualCourseId=` (2026-05-21)

### 🟡 Важно (следующий блок)

#### Профиль и аналитика
- [x] **Sprint A (2026-05-25):** Миграция `add-user-profile-fields`: новые поля User — `username VARCHAR UNIQUE`, `avatar`, `coverImage`, `bio TEXT`, `socialTelegram`, `socialWhatsApp`, `socialLinkedIn`, `languages JSONB`. Безопасная 3-шаговая миграция с backfill username для существующих пользователей
- [x] **Sprint A:** Utility `utils/username.js` — `generateUsername(name)` с транслитом кириллицы и проверкой уникальности
- [x] **Sprint A:** Авто-генерация `username` в `register` и `registerTeacher` (через `createUserWithVerification`)
- [x] **Sprint A:** `PUT /users/me/profile` — обновление своего профиля (валидация username/bio/languages, проверка уникальности)
- [x] **Sprint A:** `GET /users/@:username/profile` — публичный профиль (все авторизованные)
- [x] **Sprint A:** `userResponse` и `/auth/me` отдают `username` + `avatar`
- [x] **Sprint B (2026-05-25):** `GET /analytics/teacher/:userId` — публичный (любой авторизованный); `?period=day|week|month`; revenue 2-line (paid+charged), students/month, avgAttendance, totals
- [x] **Sprint B:** `GET /analytics/student/:id` — приватный (сам + его учитель); attendance/month, homeworkStats (только ДЗ с прошедшим дедлайном), grades timeline (10 последних), totals
- [x] **Sprint B:** Helper `utils/analyticsAccess.js` → `canViewStudentAnalytics` — проверка связи через Group↔User belongsToMany + IndividualCourse

#### Admin ✅ 2026-07-09
- [x] Миграция `20260709000002`: ALTER TYPE enum_Users_role ADD VALUE 'admin' + Users.active BOOLEAN
- [x] User.js: `role: ENUM('teacher','student','admin')` + `active: BOOLEAN DEFAULT true`
- [x] `isAdmin` в `role.js`; `isTeacher` теперь пропускает admins
- [x] `auth.js` async — проверяет `active` в БД на каждый запрос (деактивация немедленная)
- [x] `admin.controller.js`: `getStats`, `getTeachers`, `getUsers`, `deactivateUser`, `activateUser`, `setUserPlan`
- [x] `admin.routes.js` → `/api/v1/admin` (все за `auth+isAdmin`)
- [x] `ADMIN_EMAIL` bootstrap в `index.js`: при старте повышает пользователя с этим email до admin

### 🟢 Архитектура: слой валидации Zod
- [x] **`src/middleware/validate.js`** — ✅ 2026-05-31, `validate(schema, source)` → safeParse → 400 или `req[source]=data`
- [x] **`src/schemas/homework.schema.js`** — ✅ 2026-05-31, схемы create/update/submit/grade, подключены в `homework.routes.js`, контроллер очищен от ручных `if`
- [x] **`payment`** — ✅ TASK-3 (2026-06-04): `calculatePaymentSchema` (month + refine), `updatePaymentSchema`, `paginationQuery`. Порядок middleware `auth, isTeacher, validate`. **Урок Express 5:** `req.query` — getter, `validate` для query пишет в `req.validatedQuery`
- [x] **`group` + `lesson`** — ✅ TASK-4 (2026-06-04): `group.schema.js` (create/update/addStudent + scheduleSlot), `lesson.schema.js` (create/update). Подключены, контроллеры очищены
- [x] **`auth`** — ✅ TASK-5 (2026-06-12): `auth.schema.js` (register/login/changePassword). Email нормализуется схемой (`trim→toLowerCase→.pipe(z.email())` — pipe, чтобы формат проверялся ПОСЛЕ нормализации). Сетевые проверки (`validateEmail` MX/disposable) и уникальность (`User.findOne`) остались в контроллере
- [ ] Раскатать на остальные модули (user, individualCourse, individualLesson, attendance) → [TASKS.md](../../TASKS.md) секция «Бэклог» (B1/B2, техдолг)

### ⚪ Низкий приоритет
- [x] N+1 в `payment.calculate` (групповая часть) — ✅ TASK-7 (2026-06-08), один findAll с include вместо циклов
- [x] **N+1 в `getTeacherDebtTotal`** — ✅ 2026-07-09, три пакетных запроса вместо N×3 (Sprint 1)
- [x] **Дублирование debt-расчёта** — ✅ 2026-07-09, `fetchChargesAndPayments` хелпер; getTeacherDebtTotal + getDebtsForTeacher используют его
- [x] **Rate limits на мутирующие эндпоинты** — ✅ 2026-07-09: `writeLimiter` (10/мин) на `POST /payments/record` + `POST /attendance/confirm`
- [ ] N+1 в `payment.calculate` (индивидуальная часть) — цикл `Attendance.findOne` на каждый урок ещё остаётся
- [ ] Очистить `buildDateWhere` в `lesson.controller.js`
- [ ] `GET /payments/debt/:studentId`
- [ ] Refresh token
- [ ] Экспорт PDF/Excel
- [ ] Email-напоминания (Resend): за 24ч до урока и дедлайна ДЗ

---

## История изменений

| Дата | Что сделано |
|------|------------|
| 2026-07-09 | **Sprint 1 — 5 bug-fixes (ревью 2026-07-08).** (1) **N+1 `getTeacherDebtTotal`** — цикл `for...of` с 3 SQL на ученика заменён тремя пакетными запросами `Attendance.findAll IN [studentIds]` + `PaymentRecord.findAll IN [studentIds]`, суммирование в JS (аналогично `getDebtsForTeacher`). (2) **`ungradedList` dashboard** — добавлен `subQuery: false` в `HomeworkSubmission.findAll` с `limit:5` + `include` (Sequelize без флага оборачивает LIMIT в подзапрос, что ломает JOIN). Остальные 3 фикса — на фронте. |
| 2026-07-08 | **Прод-фиксы деплоя (инцидент при мёрдже в main).** (1) **`trust proxy`:** `app.set('trust proxy', 1)` в проде — Railway за прокси (X-Forwarded-For) ронял `express-rate-limit` (`ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`) → ломался логин/регистрация. (2) **CORS устойчивее:** `CLIENT_URL` — список origin через запятую + нормализация хвостового `/`; чужой origin (боты) → `cb(null,false)` вместо `throw` (не спамит Sentry). Причина «блока» была не в коде, а в `CLIENT_URL` ≠ адрес фронта (git-preview Vercel ≠ прод-URL). |
| 2026-07-05 | **Готовность к запуску — блокеры (dev-ветка).** (1) **Автотесты:** Vitest+supertest, отдельная тест-БД `polish_test` (Railway), `config/database.js` под `NODE_ENV=test`→`TEST_DATABASE_URL`, guard в `tests/setup.js` (только `*polish_test*`, `sync({force})`); 16 тестов: изоляция арендаторов (attendance/payments/user.update), расчёт долга, сброс пароля, ростер. (2) **CI:** `.github/workflows/ci.yml` — Postgres-сервис + `npm test`. (3) **Sentry:** `instrument.js` (init только при `SENTRY_DSN`, PII-скраб, перехват `console.error`→captureException), подключён первой строкой в `index.js`. (4) **Восстановление пароля:** поля User `passwordResetToken/ExpiresAt` + идемпотентная миграция `20260705000001` (применена), `sendPasswordResetEmail`, `POST /auth/forgot-password` (всегда 200) + `/reset-password` (TTL 1ч), Zod + rate-limit. (5) **Секреты:** `.env.example`; JWT-секреты сменены (утекли в public history — Cloudinary/Resend/DB ротировать вручную). (6) **Демо:** `seed-demo.js --clean` (удаление демо перед запуском). (7) **`getMyStudents` → модель `Student`** (реальные + заглушки, `id`=Student.id, `isPlaceholder`); `addStudent` и `individualLesson.create` принимают Student.id из ростера (заглушки видны в «Мои ученики» и пикере инд.урока). |
| 2026-07-03 | **Security-фиксы (ревью проекта).** **IDOR посещаемости:** `attendance.getAll` для учителя скоуплен по своим ученикам (`getTeacherStudentIds`), чужой `studentId` → пусто (было: без параметров возвращал ВСЕ записи всех учителей). **`user.update`** — только свой аккаунт (было: учитель мог переименовать любого). **N+1 в оплатах:** `getDebtsForTeacher` — пакетные запросы вместо цикла по ученикам (`attributes:['id']` на Lesson для вложенного Group). **Access-токен** дефолт `1h` (пустой `JWT_EXPIRES_IN` давал бессрочный). **env-валидация:** в prod обязательны `JWT_REFRESH_SECRET`+`CLIENT_URL`. **apiLimiter** 300→1000 (prod), `skip` в dev. **Инд.урок:** создание разового по `individualCourseId` (ученик из курса). |
| 2026-07-02 | **Rate-limit в dev выключен** (`skip: NODE_ENV!=='production'` на всех лимитерах) — 300/15мин выбивался hot-reload'ом и блокировал даже `/auth/login`. Инцидент «Слишком много запросов» разобран. |
| 2026-05-18 | Подключена БД Railway, заполнены Cloudinary credentials |
| 2026-05-18 | register-teacher, changePassword, IndividualCourse, generate-lessons |
| 2026-05-19 | Исправлены 4 критических бага (payment, attendance дубли, homework фильтр, grade) |
| 2026-05-19 | CORS + rate limit + ownership checks на update/delete всех модулей |
| 2026-05-19 | Email normalize + password validation; фильтры по датам; сортировка |
| 2026-05-19 | payment.calculate: индивидуальные уроки; ownership в payment.update |
| 2026-05-20 | sequelize-cli миграции + npm scripts |
| 2026-05-20 | Пагинация findAndCountAll на всех getAll |
| 2026-05-20 | Полное ревью: зафиксированы ownership check issues (см. REVIEW.md) |
| 2026-05-20 | Закрыты все ownership checks: homework, attendance, group, individualCourse |
| 2026-05-21 | `attendance.create` переписан на delete-then-insert в транзакции (fix `ON CONFLICT (id)` баг). `getAll` расширен: Lesson с темой/группой, IndividualLesson с именем студента |
| 2026-05-21 | helmet + JSON limit 256kb + rate-limit на register (5/15мин) + env validation |
| 2026-05-21 | Транзакции в `group.remove` и `payment.calculate`. Fix `payment.update` ownership для «чистых индивидуалов» |
| 2026-05-21 | `individualLesson.getAll`: фильтр `?individualCourseId=` |
| 2026-05-25 | **Sprint A:** профильные поля User (`username` уникальный + `avatar`, `coverImage`, `bio`, `socialTelegram/WhatsApp/LinkedIn`, `languages JSONB`); миграция с безопасным backfill; `utils/username.js` с транслитом кириллицы; авто-генерация username при регистрации; `PUT /users/me/profile` + `GET /users/@:username/profile`; `userResponse` отдаёт username и avatar |
| 2026-05-25 | **Sprint B:** Analytics API — `GET /analytics/teacher/:userId` (revenue 2-line с фильтром period day/week/month, students/month, avgAttendance, totals) + `GET /analytics/student/:id` (attendance/month, hw completion с прошедшим deadline, grades timeline, totals). Raw SQL агрегации, fillBuckets для непрерывности графиков. Helper `canViewStudentAnalytics` через Group belongsToMany + IndividualCourse. |
| 2026-05-31 | Закрыт баг #6/#8 — валидация `deadline`. **Закрыты #1–#4 (multi-tenancy)** в homework + payment. **Внедрён Zod-слой** на homework (`validate` middleware + схемы + очистка контроллера, `zod@4`). Создан TASKS.md — учебные задачи. |
| 2026-05-31 | **TASK-1 (#5):** убран gender-heuristic в `dashboard.controller` — `endsWith('а')` → `сдал(а)`/`оплатил(а)`. |
| 2026-06-02 | **TASK-2 (#7):** `payment.calculate` блокирует будущий месяц (`now < month` → 400). |
| 2026-06-04 | **TASK-3 (готово):** Zod для `payment` — calculate (+refine «не будущее»), update, paginationQuery. Порядок middleware `auth, isTeacher, validate`. Express 5: `req.query` getter → `validate` пишет в `req.validatedQuery`. |
| 2026-06-04 | **TASK-4 (готово):** Zod для `group` (create/update/addStudent + scheduleSlot day0-6/HH:MM) и `lesson` (create/update, uuid+date+time). Контроллеры очищены от ручных `if`. |
| 2026-06-07 | **TASK-6 (готово):** ownership-проверка вынесена в `utils/ownership.js` — чистый предикат `isHwOwner({lessonId,individualLessonId}, teacherId) → boolean`. Дубли убраны из `homework` (5 мест) и `attendance` (create/update). Выбран helper, а не middleware (id то в body, то в params; полиморфизм; сущность нужна дальше). Граница: utils = «да/нет», контроллер = HTTP 403. |
| 2026-06-08 | **TASK-7 (готово, групповая часть):** убран N+1 в `payment.calculate` — вместо вложенных циклов (≈50 запросов) один `Attendance.findAll` с include Lesson→Group (оба `required`, фильтр present/дата/teacherId) + перебор в JS, сумма в `totals`. ORM-путь, не raw-SQL. Изменение семантики: начисляем всем, кто посещал (ушедшие из группы теперь начисляются; нулевые Payment для не-посещавших больше не создаются). Индивидуальная часть N+1 — не тронута. |
| 2026-06-09 | **Ревью-3:** закрыты BUG-1..BUG-8. Timing-safe login (dummy bcrypt), timezone `endDate` fix в 4 файлах (`Date.UTC`), rate-limit на verify-email/resend, `lesson.getOne` ownership для teacher, `gradeSubmission` проверка sub↔hw, grade reset (`null`→`pending`), `updatePaymentSchema` `paid` обязателен. |
| 2026-06-17 | **Backfill `TeacherStudent`** (миграция `20260617000001`): перенёс существующие связи учитель↔студент из `GroupStudents`+`IndividualCourses` (UNION + ON CONFLICT DO NOTHING). Чинит «старые ученики не числятся учениками» после Sprint D. Прогнан на dev (+2 пары). `down` = no-op (backfill необратим). На проде — `db:migrate`. |
| 2026-06-15 | **Sprint D — бэкенд (готово):** 3 модели (`Follow`, `LessonRequest`, `TeacherStudent`) + поля User (`socialInstagram`, `phone`) + 4 миграции. Контроллеры: `lessonRequest` (create/getAll роль-свитч/patch accept-decline через транзакцию + `TeacherStudent`), `follow` (идемпотентно). `user.getPublicProfile` обогащён `viewerContext` + `followersCount`; новый `getMyStudents`. **Гейт** (только принятые ученики) в `group.addStudent` + `individualCourse.create` (заодно чинит утечку `user.getAll`). Zod `lessonRequest.schema`. Email `sendLessonRequestEmail` (best-effort). Роуты: `/lesson-requests`, `/users/:id/follow`, `/users/me/students`. **Протестировано вживую: e2e-смоук 23/23 passed** (профиль/viewerContext, follow, заявка+анти-спам+Zod, гейт до/после accept, accept-транзакция, 403 чужому). |
| 2026-06-12 | **TASK-5 (готово):** Zod для `auth` — `registerSchema` (name min 1, email, password min 6; общая для register и register-teacher), `loginSchema`, `changePasswordSchema` (newPassword min 6). Email: `z.string().trim().toLowerCase().pipe(z.email())` — нормализация ДО проверки формата. Контроллер очищен от ручных `if` и `toLowerCase().trim()`; `validateEmail` (MX/disposable) и проверка уникальности остались (сеть/БД — не для схемы). |
| 2026-06-23 | **Sprint E §2.6.1 — каталог учителей (бэк):** `GET /teachers/catalog` — `teacher.controller`/`teacher.schema`/`teacher.routes`, монтаж `/api/v1/teachers`. Фильтр по языку через JSONB `@> [{code}]` (languages хранится как `[{code,level?}]`), поиск `iLike` по name/username, пагинация, сортировка по числу учеников. Счётчики учеников (`TeacherStudents`) и подписчиков (`Follows`) — коррелированными подзапросами в SELECT (без N+1). Только `auth`, публичные поля без email. |
| 2026-06-22 | **Новая система оплат (точки 1–14):** помесячная `Payment` полностью снесена. Новая модель `PaymentRecord` (studentId, teacherId, amount, paidAt) — каждая оплата отдельная строка. **Долг считается живьём:** `charged` (сумма цен подтверждённых посещений, helper `computeChargedByTeacher`) − `paid` (`PaymentRecord`). Эндпоинты: `GET /payments/debt` (студент → долг по учителям), `GET /payments/debts` (учитель → долг по ученикам), `POST /payments/record` (внести оплату, гейт `TeacherStudent`). Чистые хелперы `getStudentDebtTotal`/`getTeacherDebtTotal` (кламп ≥0 — переплата не уводит в минус) переиспользованы в `dashboard.controller` (KPI долга). `analytics.controller` переведён: `revenueByPeriod.paid` ← `PaymentRecord`, `charged` ← посещения; `studentsByMonth` ← посещения. Лента активности дашборда ← `PaymentRecord` (по `paidAt`). Удалены: модель `Payment`, контроллеры `getAll`/`calculate`/`update` + хелперы, роуты `GET /payments`/`POST /calculate`/`PUT /:id`, схемы `calculate`/`update`/`pagination`, фронт `getPayments`/`calculatePayments`/`updatePayment`. `PaymentsPage` переписан (студент — долг + заглушка «Оплатить»; учитель — долг по ученикам + модалка «Внести оплату»). Миграция `20260622000001-drop-payments` (на проде — `db:migrate`). |
| 2026-06-10 | **Dual attendance confirmation:** миграция `20260609000001-add-attendance-confirmation` (поля `teacherMarked`, `studentMarked`, `status` ENUM + backfill + nullable `present`). Контроллер переписан: `create` → `pending_student`, `getPending` (учитель/студент), `confirmStudent` (студент), `teacherResolve` (accept/reject спор). Авто-подтверждение через 3 дня (raw SQL JOIN). Фронт: 3-таба UI (Журнал/Ожидают(N)/Спорные(N)) + `confirmAttendance`/`resolveAttendanceDispute` в API. |
| 2026-06-24 | **Sprint E §2.6.2 — лента постов, фаза 1 (бэк готов, e2e 15/15):** модели `Post` (`authorId`, `text`, `media` JSONB, `viewsCount`) + `PostLike` (unique `userId,postId`) + миграция `20260624000001-create-posts`. Контроллер `post.controller`: create / remove (гейт `authorId===user.id` → 403) / like+unlike (идемпотентно через unique) / `getFeed` (хронология, **keyset-курсор** base64 `createdAt|id`, лайки/likedByMe двумя запросами без N+1, просмотры — батчевый `Post.increment` одним `UPDATE ... WHERE id IN`, +1 отражается в текущем ответе) / `getByAuthor` (таб профиля). Роуты `/posts` + `/feed` (гейт `auth`, постит любая роль). Zod `post.schema` (text 1..5000, media ≤10 URL). **Решение:** «буст своих учителей» перенесён в фазу 3 (составной keyset не строим — формула ранжирования его всё равно заменит). `media`-колонка заведена сразу (фаза 2) — одна миграция на обе фазы. Фронт — следующим заходом. |
| 2026-06-24 | **Sprint E §2.6.2 — лента, фазы 2+3 (бэк, e2e 12/12):** **Фаза 3 — ранжирование:** `getFeed` переписан — хронология заменена формулой. Окно последних 200 постов скорится в JS: `recency` (time-decay `exp(-ageH/48)`) + `popularity` (лайки/(просмотры+3)) + `langMatch` (пересечение `languages` зрителя↔автора) + `boost` (подписки `Follow` + свои учителя `TeacherStudent`). Веса `W` — настроечные. **Решение по пагинации:** курсор сменил смысл keyset→офсет (base64 числа) — **фронт не тронут** (курсор непрозрачен). Старые keyset-хелперы выброшены (тот самый «выбрасываемый» код фазы 1). **Фаза 2 — медиа:** бэк уже принимал `media[]` (Zod ≤10 URL) с фазы 1; колонка `Post.media` заведена изначально. e2e: регрессия фазы 1 + буст (пост подписки выше своего: A@0/B@1) + офсет-пагинация. |
| 2026-06-24 | **РАЗВОРОТ в teacher-first ([REVISION.md](../../REVISION.md)) — решения по архитектуре (код ещё не тронут):** (1) ученик = единая сущность **`Student`** (Вариант A), `userId` nullable: заглушка (null) / реальный (аккаунт). Все «студенческие» FK (`GroupStudent`/`IndividualCourse`/`Attendance`/`PaymentRecord`/`HomeworkSubmission`.`studentId`) перенаправить со `User` на `Student` + миграция-backfill. (2) Подсчёт долга/посещаемости/ДЗ — единый для заглушек и реальных (хелперы берут заглушки наравне). (3) **Merge** заглушка→реальный: перепривязка всех FK `studentId` в транзакции + удаление заглушки (вести единый реестр FK на `Student`). (4) Онбординг: приглашение учитель→ученик (заменяет `LessonRequest`). (5) `Group.chatLink`. Соц-бэк (`post`/`follow`/`teacher`/`lessonRequest`) **запаркован** (код оставлен, помечен как соц/маркетплейс). Реализация — после проектирования и задач. |
| 2026-06-25 | **C1 — фундамент `Student` ЗАВЕРШЁН (smoke 18/18, долг = эталону).** Фазы 0–6 (REVISION.md §5.1). Модель `Student` (`teacherId`,`userId` nullable,`name`,`contact`) + частичный unique `(teacherId,userId)`. Миграции: `…0002-create-students`, `…0003-backfill-students` (7 строк из 6 источников), `20260625000001-switch-student-fk` (атомарно: DROP FK→UPDATE значений `User.id`→`Student.id` по join с teacherId→ADD FK→Students, 6 таблиц; попутно удалена 1 сирота HomeworkSubmission на удалённое ДЗ). **Код (Ф5):** ассоциации `as:'student'`→`Student` (6 шт, login-данные через `Student→account`); `utils/students.js` (`getStudentIdsForUser`/`resolveStudent`); запись в группу/курс/инд.урок резолвит `User.id`→`Student.id`; student-facing (group/lesson/attendance/homework/individualCourse/individualLesson/dashboard/payment.getDebt) агрегирует по нескольким `Student`; `recordPayment` гейт `TeacherStudent`→`Student`-владение; `analyticsAccess` упрощён до наличия `Student`-связи; `analytics.getStudentAnalytics` `= :studentId`→`IN (:studentIds)`. `getTeacherAnalytics` не менялся (COUNT DISTINCT в контексте учителя). `TeacherStudent` цел (гейт addStudent по User.id). Долг бит-в-бит = Ф0 (учитель 35, ученик 25). |
| 2026-06-26 | **C2 — заглушки + merge (фазы 0–2, 5 готовы; REVISION.md §5.2).** Ф0: `utils/studentFkRegistry.js` (6 FK→Student + unique-ключи) + `createPlaceholder()`. Ф1: `POST /groups/:id/placeholder` (без гейта `TeacherStudent`) + ветка `placeholder` в `individualCourse/individualLesson.create` (группы и индивидуалки); `group.getOne` отдаёт `isPlaceholder`/`contact`. Ф2: `attendance.create` для заглушек (`Student.userId IS NULL`) ставит сразу `confirmed`/`present` (без dual-confirm) → долг начисляется мгновенно. **Ф5 merge** (`POST /students/:id/merge`): в транзакции по `studentFkRegistry` перепривязка 6 FK source→target, конфликты unique (Attendances/HomeworkSubmissions/GroupStudents) разрешаются keep-target (DELETE дубля source ДО UPDATE), затем `source.destroy()`. Каскад НЕ используется. **Находка:** реальные `ON DELETE` есть только у `GroupStudents`; 5 FK = `ON UPDATE CASCADE` (delete=NO ACTION) — поэтому удаление/перепривязка явные. e2e: merge 10/10 (moved/skipped корректны, ноль сирот, долг Artem восстановлен). |
| 2026-06-26 | **C2 ЗАВЕРШЁН (фазы 0–6).** Ф4: `DELETE /students/:id` — полное удаление заглушки (явный снос детей по `studentFkRegistry` в транзакции, каскада на delete нет; защита `userId IS NULL` — реального не удалить, 403). e2e Ф4 5/5. Фронт (Ф3/Ф6) — UI заглушек в `GroupDetailPage` + модалка переноса. Весь цикл (создать заглушку → вести соло → перенести на реального / удалить) кликабелен. Merge/delete контроллер прокомментирован построчно. |
| 2026-07-01 | **Аудит безопасности + фиксы.** 🔴 **C1:** `.env` был закоммичен в **публичные** GitHub-репо (JWT_SECRET/DB_URL/ключи) — убран из отслеживания (`git rm --cached`); **секреты нужно ротировать вручную** (утекли). **H1:** `GET /users` без email (PII); `/users/search` — поиск по похожим (iLike ник+имя, лимит 10), фронт-список. **H2:** аналитика учителя — только сам учитель (было публично). **H3:** соц-роуты размонтированы (`posts`/`feed`/`teachers`/`lesson-requests`/follow/публ.профиль) — код запаркован. **H4:** refresh-токен (access 7д + refresh 30д в **httpOnly-cookie**, `/auth/refresh` скользящее окно, `/auth/logout`; фронт: refresh-на-401 + `withCredentials`). **M3:** `utils/cloudinary.isAllowedUploadUrl` — fileUrl/avatar/cover только с нашего облака. **M4:** SSL для прод-БД. **M6:** общий rate-limit `/api/v1` 300/15мин. Проверено curl (search/analytics 403/soc 404/refresh-цикл). Коммиты: бэк `8f83f38`,`6f3684f`; клиент `396576f`,`a3fe841`. |
| 2026-06-29 | **Аудит кабинета ученика (C5) + ревью-фиксы.** Прогон под учеником (группа→урок→ДЗ→посещаемость→оплата): дашборд/долг/посещаемость/группы/уроки — зелёные под `Student`. **Фикс 1:** сдача ДЗ без файла давала 400 — `submitHomework` Zod не принимал `null`; сделано `fileUrl`/`comment` `.nullable()` (проверено: сдача без файла→201). **Фикс 2 (ревью):** `payment.getTeacherStudentIds` (локальный, от `GroupStudent`+`IndividualCourse`) терял учеников с одними разовыми инд.уроками (`individualCourseId=null`) и убранных из групп — заменён на утилитный `utils/students.getTeacherStudentIds` (от таблицы `Student`); убрано дублирование. Проверено: ученик с разовым инд.уроком теперь в `/payments/debts` (charged 80). Доки: `ROLES.md` (убран фантомный `teacherSecret`), client `PAGES.md` (homework). REVIEW.md удалён (баги закрыты, отражены здесь). |
| 2026-06-28 | **`Group.chatLink` + восстановление unique-индексов (устойчиво к sync).** **chatLink** (ссылка на внешний чат группы, TG/WA) — поле в `Group` по образцу `lessonLink`: модель, миграция `20260628000001-add-group-chatlink`, Zod (create/update), `group.controller` (create/update), `lesson.controller` `groupInclude` (+chatLink для карточки урока). **Unique-индексы:** найдено, что unique из `20260521000001` (`addConstraint`) были **снесены `sync({alter})`** в dev (нет в моделях), на проде живы. Решение двухслойное: (1) индексы объявлены **в моделях** `Lesson`/`IndividualLesson`/`HomeworkSubmission` (`indexes:[{unique}]`) → sync их создаёт и не сносит; (2) миграция `20260628000002-restore-unique-indexes` (идемпотентна: `DROP CONSTRAINT IF EXISTS` старых + `CREATE UNIQUE INDEX IF NOT EXISTS` — `lessons_group_date_time_uidx`, `individual_lessons_course_date_time_uidx`, `homework_submissions_hw_student_uidx`). `lesson.create`/`individualLesson.create` ловят `SequelizeUniqueConstraintError` → **409**. Генераторы (`lessonGenerator` `findOrCreate`) идемпотентны — не ломаются. Verify: migrate+undo чисто, индексы 3/3, sync-рестарт без ошибок, дубль урока→409, `vite build` ✅. (1 пустой дубль-урок в dev удалён до миграции.) |
| 2026-06-28 | **C3 — приглашения, бэкенд (механика B; REVISION.md §5.3, фазы Ф1–Ф4; smoke 9/9, коммит a9f4f14).** Новая модель `Invitation` (`teacherId` отправитель, `groupId`, `inviteeUserId` получатель, `status` ENUM `pending/accepted/declined/revoked`) + миграция `20260627000001-create-invitations` с **частичным unique** `(teacherId,groupId,inviteeUserId) WHERE status='pending'` (анти-дубль активных). Отдельная модель, **не** расширение `LessonRequest` (там направление студент→учитель). Эндпоинты: `GET /users/search?username=` (учитель ищет студента точным ником, role='student', флаг `alreadyMine`); `POST /groups/:id/invitations` (если приглашаемый уже свой `Student{userId}` — прямое `GroupStudent.create` без инвайта, решение §5.3 п.3; иначе `Invitation{pending}` с анти-дублем); `GET /invitations` (роль-свитч: учитель — исходящие, студент — входящие, фильтр `?status=`); `PATCH /invitations/:id` (только `isStudent`+`inviteeUserId===me`; `accept` в транзакции: `resolveStudent`→`GroupStudent.findOrCreate`→`TeacherStudent.findOrCreate`; `decline` меняет статус). **Гейт `TeacherStudent` оставлен параллельно** (решение §5.3 п.2 — не заменяем гейт на инвайты). Zod `invitation.schema`. Фронт (Ф5–Ф6) — следующим заходом. |
