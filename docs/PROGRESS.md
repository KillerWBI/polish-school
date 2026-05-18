# Прогресс разработки

## Легенда
- ✅ Готово
- 🔶 Есть заглушка / частично
- ❌ Не начато

---

## Инфраструктура

| Задача | Статус | Заметка |
|--------|--------|---------|
| package.json + зависимости | ✅ | express, sequelize, pg, bcryptjs, jsonwebtoken, dotenv(x), nodemon |
| .env файл (UTF-8) | ✅ | 8 переменных: PORT, NODE_ENV, JWT_SECRET, JWT_EXPIRES_IN, DB_URL, TEACHER_SECRET, CLOUDINARY_* |
| src/config/database.js | ✅ | Sequelize + PostgreSQL, dotenv внутри файла |
| src/app.js | ✅ | cors + json + 9 роутов + global error handler |
| index.js | ✅ | authenticate + sync({ alter }) + listen |
| npm run dev / npm start | ✅ | nodemon / node |
| .gitignore | ✅ | node_modules/ + .env |
| Подключение к БД (Railway) | ✅ | DB_URL → публичный proxy URL Railway |
| Cloudinary credentials | ✅ | Заполнены в .env |

---

## Модели

| Модель | Создана | Ассоциации | Заметка |
|--------|---------|------------|---------|
| User | ✅ | ✅ | UUID PK, role ENUM('teacher','student') |
| Group | ✅ | ✅ | schedule JSONB, pricePerLesson DECIMAL |
| GroupStudent | ✅ | ✅ | junction, no timestamps |
| Lesson | ✅ | ✅ | materials JSONB, lessonLink nullable override |
| IndividualCourse | ✅ | ✅ | schedule JSONB, teacher + student FK, pricePerLesson |
| IndividualLesson | ✅ | ✅ | individualCourseId nullable, materials JSONB, своя цена |
| Homework | ✅ | ✅ | nullable lessonId / individualLessonId |
| HomeworkSubmission | ✅ | ✅ | fileUrl, grade nullable, status ENUM('pending','graded') |
| Attendance | ✅ | ✅ | nullable lessonId / individualLessonId |
| Payment | ✅ | ✅ | month string "2026-05", paidAt nullable |

---

## Middleware

| Файл | Статус | Что делает |
|------|--------|-----------|
| auth.js | ✅ | Проверяет JWT → req.user = { id, role } |
| role.js | ✅ | isTeacher / isStudent guards (403 если не та роль) |

---

## Утилиты

| Файл | Статус | Что делает |
|------|--------|-----------|
| utils/lessonGenerator.js | ✅ | expandSchedule, generateGroupLessons, generateIndividualLessons |

---

## Роуты и контроллеры

| Модуль | Роут | Контроллер | Полнота |
|--------|------|-----------|---------|
| Auth | ✅ | ✅ | register, register-teacher, login, me, changePassword |
| Users | ✅ | ✅ | list (students only), getOne, update (только name) |
| Groups | ✅ | ✅ | CRUD + students + generate-lessons |
| Lessons | ✅ | 🔶 | CRUD + генерация (нет query-фильтров) |
| Individual Courses | ✅ | ✅ | CRUD + generate-lessons |
| Individual Lessons | ✅ | 🔶 | CRUD + materials (нет query-фильтров) |
| Homework | ✅ | 🔶 | CRUD + submit (isStudent) + submissions + grade; getAll не фильтрует |
| Attendance | ✅ | 🔶 | bulk create + update (нет query-фильтров) |
| Payments | ✅ | 🔶 | calculate (только групповые) + mark paid |

---

## Что доделать (MVP)

### Высокий приоритет
- [ ] `homework.getAll` — фильтровать по группам студента (сейчас возвращает все ДЗ)
- [ ] `payment.calculate` — включить индивидуальные уроки в расчёт

### Средний приоритет
- [ ] Фильтры `GET /lessons?groupId=&date=`
- [ ] Фильтры `GET /attendance?lessonId=&month=`

### Низкий приоритет (после MVP)
- [ ] Долг студента: `GET /payments/debt/:studentId`
- [ ] Экспорт данных (посещаемость / оплата)
- [ ] Refresh token

---

## История изменений

| Дата | Что сделано |
|------|------------|
| 2026-05-18 | Создана полная структура проекта: модели, роуты, контроллеры, middleware, config |
| 2026-05-18 | Обновлён CLAUDE.md с точной архитектурой |
| 2026-05-18 | Исправлена кодировка .env (UTF-16 → UTF-8), подключена реальная БД Railway |
| 2026-05-18 | Созданы docs/ файлы |
| 2026-05-18 | Добавлены `POST /auth/register-teacher` (TEACHER_SECRET) и `PUT /auth/password` |
| 2026-05-18 | `PUT /users/:id` — только `name`, email не меняется |
| 2026-05-18 | `POST /homework/:id/submit` — добавлен guard `isStudent` |
| 2026-05-18 | Добавлены регулярные уроки: `IndividualCourse`, generate-lessons для групп и курсов, `src/utils/lessonGenerator.js`, `materials` JSONB и `individualCourseId` в `IndividualLesson` |
