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
| Payments | ✅ | Multi-tenancy дыра закрыта 2026-05-31 (#4). N+1 в групповой части `calculate` убран (TASK-7, 2026-06-08); в индивидуальной части N+1 ещё остаётся. `endDate` timezone fix 2026-06-09 |

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

#### Admin
- [ ] Добавить роль `admin` в ENUM модели User + миграция
- [ ] Middleware `requireAdmin` для admin-роутов
- [ ] `GET /admin/teachers` — список учителей (count студентов, дата регистрации, статус)
- [ ] `PATCH /admin/users/:id` — деактивация/активация аккаунта

### 🟢 Архитектура: слой валидации Zod
- [x] **`src/middleware/validate.js`** — ✅ 2026-05-31, `validate(schema, source)` → safeParse → 400 или `req[source]=data`
- [x] **`src/schemas/homework.schema.js`** — ✅ 2026-05-31, схемы create/update/submit/grade, подключены в `homework.routes.js`, контроллер очищен от ручных `if`
- [x] **`payment`** — ✅ TASK-3 (2026-06-04): `calculatePaymentSchema` (month + refine), `updatePaymentSchema`, `paginationQuery`. Порядок middleware `auth, isTeacher, validate`. **Урок Express 5:** `req.query` — getter, `validate` для query пишет в `req.validatedQuery`
- [x] **`group` + `lesson`** — ✅ TASK-4 (2026-06-04): `group.schema.js` (create/update/addStudent + scheduleSlot), `lesson.schema.js` (create/update). Подключены, контроллеры очищены
- [ ] Раскатать на остальные модули (auth, user, individualCourse, individualLesson, attendance) → [TASKS.md](../../TASKS.md) секция «Бэклог» (B1/B2, техдолг)

### ⚪ Низкий приоритет
- [x] N+1 в `payment.calculate` (групповая часть) — ✅ TASK-7 (2026-06-08), один findAll с include вместо циклов
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
| 2026-05-18 | Создана полная структура: модели, роуты, контроллеры, middleware |
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
| 2026-06-10 | **Dual attendance confirmation:** миграция `20260609000001-add-attendance-confirmation` (поля `teacherMarked`, `studentMarked`, `status` ENUM + backfill + nullable `present`). Контроллер переписан: `create` → `pending_student`, `getPending` (учитель/студент), `confirmStudent` (студент), `teacherResolve` (accept/reject спор). Авто-подтверждение через 3 дня (raw SQL JOIN). Фронт: 3-таба UI (Журнал/Ожидают(N)/Спорные(N)) + `confirmAttendance`/`resolveAttendanceDispute` в API. |
