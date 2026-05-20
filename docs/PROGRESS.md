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

---

## Модули

| Модуль | Статус | Нерешённые проблемы |
|--------|--------|---------------------|
| Auth | ✅ | `registerTeacher` — нет проверки пароля ≥6 |
| Users | ✅ | — |
| Groups | 🟡 | `addStudent/removeStudent/getOne/generateLessons` — нет ownership check |
| Lessons | ✅ | Запутанная WHERE логика в `getAll` (работает, но сложно читать) |
| Individual Courses | 🟡 | `getOne/generateLessons` — нет ownership check |
| Individual Lessons | ✅ | — |
| Homework | 🔴 | `create/update/delete` — нет ownership; `getSubmissions/grade` — нет ownership; `getSubmissions` — нет include User |
| Attendance | 🔴 | `create/update` — нет ownership check |
| Payments | 🟡 | N+1 запросы в `calculate` |

---

## Задачи

### 🔴 Критично (безопасность)
- [ ] `homework.create` — проверить `lessonId → Group.teacherId === req.user.id`
- [ ] `homework.update/delete` — ownership через Lesson → Group
- [ ] `homework.getSubmissions/gradeSubmission` — ownership check + include User (имя студента)
- [ ] `attendance.create/update` — ownership через Lesson/IndividualLesson
- [ ] `group.addStudent/removeStudent` — `group.teacherId === req.user.id`

### 🟡 Важно
- [ ] `group.getOne/generateLessons` — teacher ownership check
- [ ] `individualCourse.getOne/generateLessons` — teacher ownership check
- [ ] `auth.registerTeacher` — `password.length < 6`

### ⚪ Низкий приоритет
- [ ] N+1 в `payment.calculate` — заменить на JOIN
- [ ] Очистить `buildDateWhere` в `lesson.controller.js`
- [ ] `GET /payments/debt/:studentId`
- [ ] Refresh token
- [ ] Экспорт PDF/Excel

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
