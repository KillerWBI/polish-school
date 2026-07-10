# Модули проекта — Backend

Каждый модуль = модель(и) + роут + контроллер.

---

## 1. Auth ✅

- `POST /auth/register` — email normalize (Zod), MX/disposable check, bcrypt, JWT; авто-генерация username
- `POST /auth/register-teacher` — то же, role='teacher' (открытая, без teacherSecret)
- `POST /auth/login` — bcrypt timing-safe, rate-limit 20/15мин, JWT access (1h) + refresh cookie (30д)
- `GET /auth/me` — профиль текущего пользователя + username/avatar/plan/role
- `PUT /auth/password` — смена пароля по `currentPassword`
- `GET /auth/verify-email?token=` — подтверждение email (токен 24ч)
- `POST /auth/resend-verification` — повторная отправка письма (rate-limit 10/15мин)
- `POST /auth/forgot-password` — отправить ссылку сброса (всегда 200)
- `POST /auth/reset-password` — новый пароль по токену (TTL 1ч)
- `POST /auth/refresh` — обновить access-токен по httpOnly-cookie (скользящее окно 30д)
- `POST /auth/logout` — сброс refresh-cookie

**Безопасность:** Zod `auth.schema.js` (register/login/changePassword); email `trim→toLowerCase→pipe(z.email())`; MX + disposable blacklist (`services/emailValidator.js`); timing-safe login (dummy bcrypt при несуществующем email); rate-limit на register (5/15мин) и verify/resend (10/15мин); `ADMIN_EMAIL` bootstrap в `index.js`.

**Файлы:** `auth.controller.js`, `auth.routes.js`, `User.js`, `middleware/auth.js` (async, проверяет `active`), `middleware/role.js` (`isTeacher`, `isAdmin`), `schemas/auth.schema.js`, `services/emailValidator.js`

---

## 2. Users ✅

- `GET /users` — список студентов `[teacher]`, пагинация
- `GET /users/:id` — teacher видит всех, student — только себя
- `PUT /users/:id` — только `name`

**Файлы:** `user.controller.js`, `user.routes.js`

---

## 3. Groups ✅⚠️

- CRUD с ownership check на `update/delete` ✅
- Студент получает только свои группы
- Поля: `name`, `schedule`, `lessonLink`, **`chatLink`** (ссылка на внешний чат группы, TG/WA — 2026-06-28), `pricePerLesson`
- `POST /groups/:id/students` + `DELETE /groups/:id/students/:studentId` — ⚠️ нет ownership check
- `POST /groups/:id/generate-lessons { from, to }` — идемпотентно (findOrCreate по `groupId+date+time`)
- **Unique:** урок уникален по `(groupId,date,time)` (индекс в модели + миграция; дубль → 409). Аналогично IndividualLessons `(individualCourseId,date,time)` и HomeworkSubmissions `(homeworkId,studentId)` — 2026-06-28

**Файлы:** `group.controller.js`, `group.routes.js`, `Group.js`, `GroupStudent.js`, `lessonGenerator.js`

---

## 4. Lessons ✅

- CRUD с ownership check ✅
- `GET /lessons?groupId=&from=&to=&date=` + сортировка `date ASC, time ASC`
- Include: `Group { id, name, lessonLink }` + `Homeworks []`
- Пагинация `?page=&limit=` ✅

**Файлы:** `lesson.controller.js`, `lesson.routes.js`, `Lesson.js`

---

## 5. Individual Courses ✅⚠️

- CRUD с ownership check на `update/delete` ✅
- `getOne` — ⚠️ нет teacher ownership check (учитель видит чужие курсы)
- `POST /individual-courses/:id/generate-lessons` — идемпотентно

**Файлы:** `individualCourse.controller.js`, `individualCourse.routes.js`, `IndividualCourse.js`

---

## 6. Individual Lessons ✅

- CRUD с ownership check ✅
- `GET /individual-lessons?from=&to=&date=&studentId=` + сортировка
- Include: `student { id, name }` + `Homeworks []`
- Пагинация ✅

**Файлы:** `individualLesson.controller.js`, `individualLesson.routes.js`, `IndividualLesson.js`

---

## 7. Homework 🔶

- `getAll`: teacher — всё; student — только ДЗ своих групп + инд. уроков ✅
- `submit` [student]: fileUrl (Cloudinary) + comment; защита от повторной сдачи
- `grade`: валидация 0–100 ✅
- ⚠️ `create/update/delete` — нет ownership check
- ⚠️ `getSubmissions/gradeSubmission` — нет ownership check

**Файлы:** `homework.controller.js`, `homework.routes.js`, `Homework.js`, `HomeworkSubmission.js`

---

## 8. Attendance 🔶

- `POST` bulk create с `updateOnDuplicate: ['present']` ✅
- Уникальные индексы `(lessonId, studentId)` и `(individualLessonId, studentId)` ✅
- `GET?lessonId=&groupId=&month=YYYY-MM&from=&to=&studentId=` ✅
- Пагинация ✅
- ⚠️ `create/update` — нет ownership check

**Файлы:** `attendance.controller.js`, `attendance.routes.js`, `Attendance.js`

---

## 9. Payments ✅ (live-debt модель, 2026-06-22)

Помесячная `Payment` удалена. Долг считается живьём.

- **Начислено** = Σ(подтверждённые посещения × цена урока) — через `computeChargedByTeacher`
- **Оплачено** = Σ(`PaymentRecord.amount`)
- **Долг** = начислено − оплачено (кламп ≥0)

Эндпоинты:
- `GET /payments/debts` — учитель: долг по каждому ученику
- `GET /payments/debt` — студент: долг по каждому учителю
- `POST /payments/record` — внести оплату (`studentId`, `amount`, `method`: cash/card/transfer/online)
- `GET /payments/history` — история оплат (фильтры studentId/method/from/to + сводка byMethod)

**Оптимизации:** `fetchChargesAndPayments(studentIds, teacherId)` — хелпер 3 пакетных запроса через `Promise.all`; `getTeacherDebtTotal` и `getDebtsForTeacher` используют его (устранён N+1). `writeLimiter` (10/мин) на `POST /payments/record`.

**Модель:** `PaymentRecord` (id, studentId→Student, teacherId→User, amount DECIMAL, method ENUM, source ENUM, paidAt DATE, screenshotUrl)

**Файлы:** `payment.controller.js`, `payment.routes.js`, `PaymentRecord.js`, `utils/debtHelpers.js`

---

## 9.5. Students — заглушки + перенос ✅ (C1/C2)

**Файлы:** `Student.js`, `student.controller.js`, `student.routes.js`, `student.schema.js`, `utils/students.js`, `utils/studentFkRegistry.js`

Ученик — единая запись **`Student`** `{ teacherId, userId (nullable), name, contact }` (C1): `userId=null` → заглушка, заполнен → реальный. Все 6 FK `studentId` (`GroupStudent`/`IndividualCourse`/`IndividualLesson`/`Attendance`/`PaymentRecord`/`HomeworkSubmission`) ссылаются на `Student.id`.

- `utils/students.js` — `getStudentIdsForUser`, `resolveStudent` (User.id→Student), `getTeacherStudentIds`, `createPlaceholder`.
- `utils/studentFkRegistry.js` — реестр 6 FK (для merge/удаления).
- `merge` (`POST /students/:id/merge`) — перенос заглушки на реального: перепривязка 6 FK в транзакции + разрешение дублей (keep-target) + удаление заглушки.
- `remove` (`DELETE /students/:id`) — полное удаление заглушки (явный снос детей по реестру), защита `userId IS NULL`.
- Создание заглушки — `POST /groups/:id/placeholder` + ветка `placeholder` в `individualCourse/individualLesson.create`.

Подробно — [REVISION.md](../../REVISION.md) §5.1–5.2.

---

## 9.6. Invitations — приглашения в группу ✅ бэк (C3 механика B)

**Файлы:** `Invitation.js`, `invitation.controller.js`, `invitation.routes.js`, `invitation.schema.js` (+ `searchByUsername` в `user.controller.js`)

Приглашение **учитель→ученик** в группу `{ teacherId, groupId, inviteeUserId, status }`, `status` ENUM `pending/accepted/declined/revoked`. Частичный unique `(teacherId,groupId,inviteeUserId) WHERE status='pending'` — анти-дубль активных. Отдельная модель (не `LessonRequest` — там обратное направление).

- `GET /users/search?username=` — учитель ищет студента точным ником (`role='student'`), флаг `alreadyMine`.
- `create` (`POST /groups/:id/invitations`) — если приглашаемый уже свой `Student{userId}` → прямое `GroupStudent.create` без инвайта; иначе `Invitation{pending}` с анти-дублем.
- `getAll` (`GET /invitations`) — роль-свитч (учитель: исходящие; студент: входящие), фильтр `?status=`.
- `patch` (`PATCH /invitations/:id`) — только `isStudent` + сам приглашённый; `accept` в транзакции: `resolveStudent`→`GroupStudent.findOrCreate`→`TeacherStudent.findOrCreate`; `decline` меняет статус.
- Гейт `TeacherStudent` **оставлен параллельно** (не заменён на инвайты).

Фронт (Ф5–Ф6) — в работе. Подробно — [REVISION.md](../../REVISION.md) §5.3.

---

## 10. Admin ✅ (2026-07-09)

Все эндпоинты за `auth + isAdmin`. Middleware `isAdmin` — `role !== 'admin'` → 403. `isTeacher` пропускает admin.

- `GET /admin/stats` — KPI: count(teachers/students/groups/lessons), sum(PaymentRecord.amount)
- `GET /admin/teachers` — пагинированный список учителей (name, email, username, plan, active, emailVerified)
- `GET /admin/users` — все пользователи с фильтром `?role=&active=`
- `PATCH /admin/users/:id/deactivate` — `active=false` (нельзя деактивировать admin)
- `PATCH /admin/users/:id/activate` — `active=true`
- `PATCH /admin/users/:id/role` — смена роли (teacher/student/admin); нельзя понизить себя
- `PATCH /admin/users/:id/plan` — смена тарифа (только для teacher); free/pro/school

**Модель User:** добавлены поля `role: ENUM('teacher','student','admin')` + `active: BOOLEAN DEFAULT true` (миграция `20260709000002`). `auth.js` проверяет `active` при каждом запросе — деактивация немедленная без перелогина.

**bootstrap:** `ADMIN_EMAIL` в `.env` → при старте `index.js` находит пользователя и повышает до admin. Первый admin создаётся так; следующих — через `/admin` → «Сменить роль».

**Файлы:** `admin.controller.js`, `admin.routes.js`

---

## 11. Инфраструктура ✅

### Запуск
- `development`: `sync({ alter: true })` — автосинхронизация схемы
- `production`: только `sequelize.authenticate()`, схема через `npm run db:migrate`

### Migrations
- `.sequelizerc` → пути к конфигу и миграциям
- `src/config/sequelize-config.js` — для sequelize-cli
- `src/migrations/20260519000000-create-all-tables.js` — начальная миграция

### Утилиты
| Функция | Что делает |
|---------|-----------|
| `expandSchedule(schedule, from, to)` | JSONB-расписание → массив `{date, time}` за период |
| `generateGroupLessons({ groupId, from, to })` | `findOrCreate` по `(groupId, date, time)` |
| `generateIndividualLessons({ courseId, from, to })` | `findOrCreate` по `(individualCourseId, date, time)` |

Защита: `from > to` → 400; диапазон > 365 дней → 400.
