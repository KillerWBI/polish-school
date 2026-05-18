# Модули проекта

Каждый модуль = модель(и) + роут + контроллер.

---

## 1. Auth — аутентификация

**Статус:** ✅ Готов

**Что умеет:**
- `POST /auth/register` — создаёт студента, возвращает JWT
- `POST /auth/register-teacher` — создаёт учителя с проверкой `teacherSecret` из `.env`. Используется через Postman.
- `POST /auth/login` — bcrypt сравнение, возвращает JWT
- `GET /auth/me` — профиль текущего пользователя
- `PUT /auth/password` — смена пароля (требует `currentPassword` + `newPassword`)

**Что нет:**
- Восстановление пароля по email
- Email-верификация
- Refresh token

**Файлы:**
- `src/controllers/auth.controller.js`
- `src/routes/auth.routes.js`
- `src/models/User.js`
- `src/middleware/auth.js`
- `src/middleware/role.js`

---

## 2. Users — пользователи

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- `GET /users` — список всех студентов [teacher]
- `GET /users/:id` — профиль (teacher видит всех, student — только себя)
- `PUT /users/:id` — обновить только `name` (email не редактируется, teacher или владелец)

**Что нет:**
- Загрузка аватара
- Удаление аккаунта

**Файлы:**
- `src/controllers/user.controller.js`
- `src/routes/user.routes.js`

---

## 3. Groups — группы

**Статус:** ✅ Готов

**Что умеет:**
- CRUD группы (schedule JSONB `[{day, time}]`, постоянная Zoom-ссылка, `pricePerLesson`)
- Список групп: teacher видит все свои, student — только в которых состоит
- Добавление / удаление студентов
- `POST /groups/:id/generate-lessons` — массовая генерация `Lesson` по `schedule` за период

**Что нет:**
- Архивирование группы (мягкое удаление)

**Файлы:**
- `src/controllers/group.controller.js`
- `src/routes/group.routes.js`
- `src/models/Group.js`
- `src/models/GroupStudent.js`
- `src/utils/lessonGenerator.js`

---

## 4. Lessons — групповые уроки

**Статус:** ✅ Готов

**Что умеет:**
- Создание одиночного урока (`POST /lessons`)
- Массовая генерация по `Group.schedule` через `POST /groups/:id/generate-lessons` (идемпотентно)
- Материалы урока JSONB: `[{type: 'link'|'file'|'text', url?, content?, title?}]`
- Ссылка на урок (переопределяет постоянную ссылку группы)
- Teacher видит уроки всех своих групп; student — только своих групп
- Студент не может открыть урок чужой группы
- Любой урок редактируется / удаляется по отдельности независимо от способа создания

**Что нет:**
- Фильтрация `GET /lessons?groupId=&date=` по query-параметрам

**Файлы:**
- `src/controllers/lesson.controller.js`
- `src/routes/lesson.routes.js`
- `src/models/Lesson.js`

---

## 5. Individual Courses — расписание индивидуальных занятий

**Статус:** ✅ Готов

По структуре аналогичен `Group`: хранит контракт между учителем и студентом (расписание, цена, ссылка), из которого генерируются конкретные `IndividualLesson`.

**Что умеет:**
- CRUD курса (`name`, `schedule`, `lessonLink`, `pricePerLesson`)
- `POST /individual-courses/:id/generate-lessons` — массовая генерация `IndividualLesson` (идемпотентно)
- Teacher видит все свои курсы; student — только свои
- При удалении курса уроки остаются (`individualCourseId` → `null`)

**Файлы:**
- `src/controllers/individualCourse.controller.js`
- `src/routes/individualCourse.routes.js`
- `src/models/IndividualCourse.js`
- `src/utils/lessonGenerator.js`

---

## 6. Individual Lessons — индивидуальные уроки

**Статус:** ✅ Готов

Конкретный урок — создаётся автоматически из `IndividualCourse.schedule` или вручную (без привязки к курсу).

**Что умеет:**
- Создание разового урока (`POST /individual-lessons`, `individualCourseId = null`)
- Поля `teacherId`, `studentId`, `pricePerLesson`, `lessonLink` — своя цена и ссылка для каждого урока (можно override после генерации)
- `materials` JSONB — те же типы, что у `Lesson`
- Опциональный `individualCourseId` — FK на курс (null для разовых)
- Teacher видит все свои уроки; student — только свои
- Любой урок редактируется / удаляется по отдельности

**Что нет:**
- Фильтрация по студенту / дате

**Файлы:**
- `src/controllers/individualLesson.controller.js`
- `src/routes/individualLesson.routes.js`
- `src/models/IndividualLesson.js`

---

## 7. Homework — домашние задания

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Создание ДЗ — привязывается к `lessonId` **или** `individualLessonId` (одно обязательно)
- `POST /homework/:id/submit` — только студент (guard `isStudent`); fileUrl из Cloudinary + comment
- Проверка на повторную сдачу одного ДЗ
- `GET /homework/:id/submissions` — все сдачи [teacher]
- `PUT /homework/:id/submissions/:subId` — оценка (`grade`) + status → 'graded' [teacher]

**Что нет:**
- `getAll` не фильтрует по группам студента (возвращает все ДЗ — нужна доработка)
- Статус `returned` (возвращено на доработку)

**Файлы:**
- `src/controllers/homework.controller.js`
- `src/routes/homework.routes.js`
- `src/models/Homework.js`
- `src/models/HomeworkSubmission.js`

---

## 8. Attendance — посещаемость

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- `POST /attendance` — bulk create: `{ lessonId?, individualLessonId?, records: [{studentId, present}] }`
- `PUT /attendance/:id` — исправить `present`
- Teacher видит всё; student — только свою посещаемость

**Что нет:**
- Фильтрация `GET /attendance?lessonId=&groupId=&month=`

**Файлы:**
- `src/controllers/attendance.controller.js`
- `src/routes/attendance.routes.js`
- `src/models/Attendance.js`

---

## 9. Payments — оплата

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- `POST /payments/calculate` — для каждого студента каждой группы учителя: `amount = кол-во присутствий × pricePerLesson`; `findOrCreate` — не дублирует при повторном вызове
- `PUT /payments/:id` — `{ paid: true }` → `paidAt = NOW()`; `{ paid: false }` → `paidAt = null`
- Teacher видит все оплаты; student — только свои

**Что нет:**
- Учёт индивидуальных уроков в расчёте (сейчас только групповые)
- `GET /payments/debt/:studentId` — долг студента

**Файлы:**
- `src/controllers/payment.controller.js`
- `src/routes/payment.routes.js`
- `src/models/Payment.js`

---

## Утилиты

### `src/utils/lessonGenerator.js`

| Функция | Что делает |
|---------|-----------|
| `expandSchedule(schedule, from, to)` | Разворачивает JSONB-расписание в массив `{date, time}` за период |
| `generateGroupLessons({ groupId, from, to })` | Создаёт `Lesson` записи, `findOrCreate` по `(groupId, date, time)` |
| `generateIndividualLessons({ courseId, from, to })` | Создаёт `IndividualLesson` записи, `findOrCreate` по `(individualCourseId, date, time)` |

Защита: `from > to` → 400; диапазон > 365 дней → 400.

---

## Известные заглушки и TODO

| Что | Где | Приоритет |
|-----|-----|-----------|
| `homework.getAll` не фильтрует по группам студента | homework.controller.js | Высокий |
| Индивидуальные уроки не входят в расчёт Payment | payment.controller.js | Высокий |
| Нет query-фильтров для `GET /lessons?groupId=&date=` | lesson.controller.js | Средний |
| Нет фильтрации attendance по уроку / группе / месяцу | attendance.controller.js | Средний |
