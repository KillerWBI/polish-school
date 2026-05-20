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
- `POST /groups/:id/students` + `DELETE /groups/:id/students/:studentId` — ⚠️ нет ownership check
- `POST /groups/:id/generate-lessons { from, to }` — идемпотентно (findOrCreate по `groupId+date+time`)

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
