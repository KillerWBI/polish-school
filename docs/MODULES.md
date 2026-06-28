# Модули проекта — Backend

Каждый модуль = модель(и) + роут + контроллер.

---

## 1. Auth ✅

- `POST /auth/register` — email normalize, пароль ≥6, возвращает JWT
- `POST /auth/register-teacher` — проверяет `teacherSecret` из `.env`
- `POST /auth/login` — email normalize, bcrypt, rate limit 20/15мин, возвращает JWT
- `GET /auth/me` — профиль текущего пользователя
- `PUT /auth/password` — смена пароля по `currentPassword`

**Что нет:** восстановление пароля, email-верификация, refresh token  
**Файлы:** `auth.controller.js`, `auth.routes.js`, `User.js`, `middleware/auth.js`, `middleware/role.js`

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

## 9. Payments ✅

- `calculate`: групповые + индивидуальные уроки ✅
- `findOrCreate` — не дублирует при повторном вызове ✅
- `update` — ownership check через `GroupStudent → Group.teacherId` ✅
- Include `student { id, name, email }` + сортировка `month DESC` ✅
- Пагинация ✅
- ⚠️ N+1 в `calculate` (цикл по студентам)

**Файлы:** `payment.controller.js`, `payment.routes.js`, `Payment.js`

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

## 10. Инфраструктура ✅

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
