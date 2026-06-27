# Роли пользователей

> ⚠️ **Частично устарело (актуал — [REVISION.md](../../REVISION.md)).** (1) Регистрация учителя **открытая**, без `teacherSecret` (он удалён). (2) После разворота teacher-first «ученик» в данных — это запись **`Student`** (заглушка без аккаунта ИЛИ реальный с `userId`), а не просто `User` с ролью `student`; `studentId` везде = `Student.id`. Модель ученика — REVISION.md §2.1/§5.

## Роли в системе

| Роль | Значение | Создаётся |
|------|----------|-----------|
| `teacher` | Учитель — полный доступ | `POST /auth/register-teacher` (через Postman, требует `teacherSecret`) |
| `student` | Студент | `POST /auth/register` (открытая регистрация) |

---

## Что может teacher

### Auth / Profile
- Регистрация (`register-teacher` + `teacherSecret`), логин
- Просмотр своего профиля (`GET /auth/me`)
- Редактирование имени (`PUT /users/:id`, только `name`)
- Смена пароля (`PUT /auth/password`)

### Users
- Видит список всех студентов (`GET /users`)
- Редактирует имя любого профиля (`PUT /users/:id`)

### Groups
- Создаёт, редактирует, удаляет группы
- Добавляет / убирает студентов из групп
- Генерирует уроки по расписанию группы (`POST /groups/:id/generate-lessons`)

### Lessons
- Создаёт, редактирует, удаляет уроки
- Добавляет материалы к урокам

### Individual Courses
- Создаёт, редактирует, удаляет контракты расписания с любым студентом
- Генерирует индивидуальные уроки из расписания курса

### Individual Lessons
- Создаёт, редактирует, удаляет индивидуальные уроки (разовые или из серии)

### Homework
- Создаёт, редактирует, удаляет задания
- Просматривает все сдачи (`GET /homework/:id/submissions`)
- Выставляет оценки (`PUT /homework/:id/submissions/:subId`)

### Attendance
- Выставляет посещаемость bulk (`POST /attendance`)
- Исправляет записи (`PUT /attendance/:id`)

### Payments
- Запускает расчёт оплаты за месяц (`POST /payments/calculate`)
- Отмечает оплату выполненной / отменяет (`PUT /payments/:id`)

---

## Что может student

### Auth / Profile
- Открытая регистрация (`POST /auth/register`)
- Логин
- Просмотр только своего профиля
- Редактирование только своего имени
- Смена своего пароля

### Groups
- Видит только группы, в которых состоит
- Видит список студентов группы (`GET /groups/:id`)

### Lessons
- Видит уроки только своих групп (тема, дата, время, материалы, ссылка)
- Не может открыть урок чужой группы

### Individual Courses
- Видит только свои курсы (где он `studentId`)

### Individual Lessons
- Видит только свои индивидуальные уроки

### Homework
- Видит задания (нужна доработка — сейчас `getAll` возвращает все)
- Сдаёт ДЗ: `fileUrl` (Cloudinary, загружен на фронте) + comment
- Не может сдать одно ДЗ дважды

### Attendance
- Видит только свою посещаемость

### Payments
- Видит только свои записи оплаты

---

## Таблица доступа к эндпоинтам

| Эндпоинт | teacher | student |
|----------|---------|---------|
| POST /auth/register | ✅ | ✅ |
| POST /auth/register-teacher | ✅ (+ teacherSecret) | ✅ (+ teacherSecret) |
| POST /auth/login | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ |
| PUT /auth/password | ✅ | ✅ |
| GET /users | ✅ | ❌ |
| GET /users/:id | ✅ | только себя |
| PUT /users/:id | ✅ (только name) | только себя (только name) |
| GET /groups | ✅ все свои | ✅ свои |
| POST /groups | ✅ | ❌ |
| GET /groups/:id | ✅ | ✅ если член |
| PUT/DELETE /groups/:id | ✅ | ❌ |
| POST /groups/:id/students | ✅ | ❌ |
| DELETE /groups/:id/students/:id | ✅ | ❌ |
| POST /groups/:id/generate-lessons | ✅ | ❌ |
| GET /lessons | ✅ все своих групп | ✅ своих групп |
| POST /lessons | ✅ | ❌ |
| GET /lessons/:id | ✅ | ✅ если член группы |
| PUT/DELETE /lessons/:id | ✅ | ❌ |
| GET /individual-courses | ✅ все свои | ✅ свои |
| POST /individual-courses | ✅ | ❌ |
| GET /individual-courses/:id | ✅ | ✅ если свой |
| PUT/DELETE /individual-courses/:id | ✅ | ❌ |
| POST /individual-courses/:id/generate-lessons | ✅ | ❌ |
| GET /individual-lessons | ✅ все свои | ✅ свои |
| POST /individual-lessons | ✅ | ❌ |
| GET /individual-lessons/:id | ✅ | ✅ если свой |
| PUT/DELETE /individual-lessons/:id | ✅ | ❌ |
| GET /homework | ✅ все | 🔶 все (нужна доработка) |
| POST/PUT/DELETE /homework | ✅ | ❌ |
| POST /homework/:id/submit | ❌ | ✅ |
| GET /homework/:id/submissions | ✅ | ❌ |
| PUT /homework/:id/submissions/:subId | ✅ | ❌ |
| GET /attendance | ✅ все | ✅ только свою |
| POST /attendance | ✅ | ❌ |
| PUT /attendance/:id | ✅ | ❌ |
| GET /payments | ✅ все | ✅ только свои |
| POST /payments/calculate | ✅ | ❌ |
| PUT /payments/:id | ✅ | ❌ |

---

## Как создать учителя

Через Postman — `POST /api/v1/auth/register-teacher`:

```json
{
  "name": "Имя Учителя",
  "email": "teacher@school.com",
  "password": "пароль",
  "teacherSecret": "<значение TEACHER_SECRET из .env>"
}
```

`teacherSecret` должен совпадать с переменной `TEACHER_SECRET` в файле `.env`.  
Возвращает `{ data: { token, user } }` — токен сразу готов к использованию.
