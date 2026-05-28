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
| Homework | 🔴 | **Multi-tenancy дыры:** `getAll` для teacher без teacherId-фильтра, `submit` без membership check, `getOne` без ownership check (см. [REVIEW.md](../../REVIEW.md) #1-#3) |
| Attendance | ✅ | — |
| Payments | 🔴 | **Multi-tenancy дыра:** `getAll` для teacher возвращает все Payment в БД (см. [REVIEW.md](../../REVIEW.md) #4) + N+1 в `calculate` |

---

## Задачи

### 🔴 СРОЧНО — Sprint 0 SECURITY FIX (найдено 2026-05-27)

Блокер для публичного запуска. До этих фиксов нельзя пускать второго учителя в платформу.

- [ ] **#1 `homework.controller.js:32`** — `getAll` для teacher: добавить фильтр через lessonIds учителя (учитель сейчас видит все ДЗ всех учителей)
- [ ] **#2 `homework.controller.js:submit`** — проверить что студент состоит в группе/инд.уроке этого ДЗ (сейчас может сдать любое чужое ДЗ)
- [ ] **#3 `homework.controller.js:getOne`** — добавить ownership/membership check
- [ ] **#4 `payment.controller.js:getAll`** — для teacher фильтровать `where.studentId IN (его студенты)` (сейчас возвращает все Payment в БД)
- [ ] **#5** Убрать gender-heuristic в `dashboard.controller` activity feed (`name?.endsWith('а')` ломается на «Никита»)
- [ ] **#6** Валидация `deadline >= now` в `homework.create`
- [ ] **#7** Валидация `month` (не future) в `payment.calculate`
- [ ] **#8** N+1 в `payment.calculate` — заменить циклы на один SQL с GROUP BY

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

### ⚪ Низкий приоритет
- [ ] N+1 в `payment.calculate` — заменить на JOIN
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
