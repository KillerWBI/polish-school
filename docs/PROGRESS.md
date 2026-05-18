# Прогресс разработки

## Легенда
- ✅ Готово
- 🔶 Есть заглушка / частично
- ❌ Не начато

---

## Инфраструктура

| Задача | Статус | Заметка |
|--------|--------|---------|
| package.json + зависимости | ✅ | express, sequelize, pg, bcryptjs, jsonwebtoken, dotenv, nodemon |
| .env файл (UTF-8) | ✅ | DB_URL, JWT_SECRET, PORT, Cloudinary keys |
| src/config/database.js | ✅ | Sequelize + PostgreSQL |
| src/app.js | ✅ | middleware + все роуты подключены |
| index.js (точка входа) | ✅ | authenticate + sync({ alter }) + listen |
| npm run dev / npm start | ✅ | |
| .gitignore | ❌ | Нужно создать (исключить node_modules, .env) |
| Подключение к реальной БД | ❌ | DB_URL заполнен заглушкой |
| Cloudinary credentials в .env | ❌ | Поля пустые |

---

## Модели

| Модель | Создана | Ассоциации | Заметка |
|--------|---------|------------|---------|
| User | ✅ | ✅ | UUID PK, role ENUM |
| Group | ✅ | ✅ | schedule JSONB, pricePerLesson |
| GroupStudent | ✅ | ✅ | junction без timestamps |
| Lesson | ✅ | ✅ | materials JSONB, lessonLink override |
| IndividualLesson | ✅ | ✅ | отдельная модель, своя цена |
| Homework | ✅ | ✅ | nullable lessonId / individualLessonId |
| HomeworkSubmission | ✅ | ✅ | fileUrl, grade, status ENUM |
| Attendance | ✅ | ✅ | nullable lessonId / individualLessonId |
| Payment | ✅ | ✅ | month string "2026-05" |

---

## Middleware

| Файл | Статус | Что делает |
|------|--------|-----------|
| auth.js | ✅ | Проверяет JWT, добавляет req.user |
| role.js | ✅ | isTeacher / isStudent guards |

---

## Роуты и контроллеры

| Модуль | Роут | Контроллер | Полнота |
|--------|------|-----------|---------|
| Auth | ✅ | ✅ | Полный: register, login, me |
| Users | ✅ | ✅ | Базовый: list, getOne, update |
| Groups | ✅ | ✅ | Полный: CRUD + студенты |
| Lessons | ✅ | 🔶 | Базовый CRUD (нет фильтров) |
| Individual Lessons | ✅ | 🔶 | Базовый CRUD (нет фильтров) |
| Homework | ✅ | 🔶 | Есть submit/grade, но getAll не фильтрует |
| Attendance | ✅ | 🔶 | Bulk create, нет фильтров |
| Payments | ✅ | 🔶 | Calculate (только группы), нет индивидуальных |

---

## Что нужно сделать перед первым запуском

1. ❌ Заполнить `DB_URL` в `.env` реальными данными PostgreSQL
2. ❌ Создать `.gitignore`
3. ❌ Запустить `npm run dev` и проверить что БД синхронизировалась
4. ❌ Протестировать `POST /auth/register` и `POST /auth/login`

---

## Что доделать после первого запуска (MVP)

### Высокий приоритет
- [ ] `homework.getAll` — фильтровать по группам студента
- [ ] `payment.calculate` — включить индивидуальные уроки в расчёт
- [ ] `.gitignore` — создать

### Средний приоритет
- [ ] Фильтры для `GET /lessons?groupId=&date=`
- [ ] Фильтры для `GET /attendance?lessonId=`
- [ ] `IndividualLesson` — добавить поле `materials` JSONB

### Низкий приоритет (после MVP)
- [ ] Смена пароля (`PUT /auth/password`)
- [ ] Автогенерация уроков по расписанию группы
- [ ] Долг студента: `GET /payments/debt/:studentId`
- [ ] Экспорт данных (посещаемость / оплата)
- [ ] Refresh token

---

## История изменений

| Дата | Что сделано |
|------|------------|
| 2026-05-18 | Создана полная структура проекта: модели, роуты, контроллеры, middleware, config |
| 2026-05-18 | Обновлён CLAUDE.md с точной архитектурой и решёнными вопросами |
| 2026-05-18 | Исправлена кодировка .env (UTF-16 → UTF-8) |
| 2026-05-18 | Созданы docs/ файлы |
