# Модули проекта

Каждый модуль = модель(и) + роут + контроллер.

---

## 1. Auth — аутентификация

**Статус:** ✅ Готов

**Что умеет:**
- `POST /auth/register` — создаёт пользователя с ролью `student`, возвращает JWT
- `POST /auth/login` — проверяет email/password (bcrypt), возвращает JWT
- `GET /auth/me` — возвращает профиль текущего пользователя

**Что нет:**
- Смена пароля
- Восстановление пароля по email
- Email-верификация

**Файлы:**
- `src/controllers/auth.controller.js` — полная реализация
- `src/routes/auth.routes.js`
- `src/models/User.js`
- `src/middleware/auth.js` — JWT guard
- `src/middleware/role.js` — isTeacher / isStudent

---

## 2. Users — пользователи

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- `GET /users` — список всех студентов [teacher]
- `GET /users/:id` — профиль (teacher видит всех, student — только себя)
- `PUT /users/:id` — обновить name/email (teacher или владелец)

**Что нет:**
- Смена пароля
- Загрузка аватара
- Удаление аккаунта

**Файлы:**
- `src/controllers/user.controller.js`
- `src/routes/user.routes.js`

---

## 3. Groups — группы

**Статус:** ✅ Готов

**Что умеет:**
- Создание группы с расписанием (JSONB `[{day, time}]`) и постоянной Zoom-ссылкой
- Получение списка групп (teacher — свои, student — в которых состоит)
- Добавление / удаление студентов из группы
- Цена урока на группу (`pricePerLesson`)

**Что нет:**
- Архивирование группы (мягкое удаление)
- История изменений расписания

**Файлы:**
- `src/controllers/group.controller.js`
- `src/routes/group.routes.js`
- `src/models/Group.js`
- `src/models/GroupStudent.js`

---

## 4. Lessons — групповые уроки

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Создание урока с датой, временем, темой
- Материалы урока в JSONB: `[{type: 'link'|'file'|'text', url?, content?, title?}]`
- Ссылка на урок (переопределяет постоянную ссылку группы)
- Студент видит только уроки своих групп

**Что нет:**
- Генерация уроков по расписанию группы (автосоздание из `Group.schedule`)
- Фильтрация по дате / диапазону дат
- Поиск по теме

**Файлы:**
- `src/controllers/lesson.controller.js`
- `src/routes/lesson.routes.js`
- `src/models/Lesson.js`

---

## 5. Individual Lessons — индивидуальные уроки

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Создание урока между учителем и конкретным студентом
- Своя цена за урок (`pricePerLesson`)
- Дата, время, ссылка, тема

**Что нет:**
- Материалы урока (JSONB как у Lesson) — не добавлено
- Фильтрация по студенту / дате

**Файлы:**
- `src/controllers/individualLesson.controller.js`
- `src/routes/individualLesson.routes.js`
- `src/models/IndividualLesson.js`

---

## 6. Homework — домашние задания

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Создание ДЗ к групповому или индивидуальному уроку
- Сдача ДЗ студентом: `fileUrl` (Cloudinary) + comment
- Просмотр всех сдач учителем
- Выставление оценки

**Что нет:**
- Фильтрация ДЗ для студента только по его группам (сейчас `getAll` возвращает всё — нужно доработать)
- Статус `returned` (возвращено на доработку)
- Уведомления о новой сдаче

**Файлы:**
- `src/controllers/homework.controller.js`
- `src/routes/homework.routes.js`
- `src/models/Homework.js`
- `src/models/HomeworkSubmission.js`

---

## 7. Attendance — посещаемость

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Массовое выставление посещаемости для урока (bulk: массив `[{studentId, present}]`)
- Исправление отдельной записи
- Студент видит только свою посещаемость

**Что нет:**
- Автосоздание записей Attendance для всех студентов при создании Lesson
- Фильтрация по уроку / группе / месяцу

**Файлы:**
- `src/controllers/attendance.controller.js`
- `src/routes/attendance.routes.js`
- `src/models/Attendance.js`

---

## 8. Payments — оплата

**Статус:** ✅ Готов (базовый)

**Что умеет:**
- Расчёт оплаты за месяц: `кол-во посещений × pricePerLesson` по каждой группе
- `findOrCreate` — не создаёт дубли при повторном расчёте
- Отметка оплачено / не оплачено (с датой оплаты)

**Что нет:**
- Учёт индивидуальных уроков в расчёте (сейчас только групповые)
- Просмотр долга (сумма неоплаченных платежей по студенту)
- Экспорт в PDF / Excel

**Файлы:**
- `src/controllers/payment.controller.js`
- `src/routes/payment.routes.js`
- `src/models/Payment.js`

---

## Известные заглушки и TODO

| Что | Где | Приоритет |
|-----|-----|-----------|
| `homework.getAll` не фильтрует по группам студента | homework.controller.js | Высокий |
| IndividualLesson без materials JSONB | IndividualLesson.js | Средний |
| Индивидуальные уроки не входят в расчёт Payment | payment.controller.js | Высокий |
| Нет фильтрации attendance по уроку/группе | attendance.controller.js | Средний |
| Нет автогенерации уроков из Group.schedule | — | Низкий (MVP) |
