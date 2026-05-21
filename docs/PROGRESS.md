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
| **Env validation при старте** (`JWT_SECRET`, `DB_URL`, `TEACHER_SECRET`) | ✅ 2026-05-21 |

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
| Homework | ✅ | — |
| Attendance | ✅ | — |
| Payments | 🟡 | N+1 запросы в `calculate` |

---

## Задачи

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

### ⚪ Низкий приоритет
- [ ] N+1 в `payment.calculate` — заменить на JOIN
- [ ] Очистить `buildDateWhere` в `lesson.controller.js`
- [ ] Unique constraints на `Lesson(groupId, date, time)` и `HomeworkSubmission(homeworkId, studentId)` — миграция
- [ ] `GET /payments/debt/:studentId`
- [ ] Refresh token
- [ ] Экспорт PDF/Excel
- [ ] Health check `/health`

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
