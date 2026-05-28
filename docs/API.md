# API Reference

Base URL: `/api/v1`

Auth header: `Authorization: Bearer <token>`

Response format:
- Success: `{ "data": ... }`
- Error: `{ "error": "сообщение" }`

---

## Auth

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| POST | `/auth/register` | — | — | Регистрация студента |
| POST | `/auth/register-teacher` | — | — | Регистрация учителя (требует `teacherSecret`) |
| POST | `/auth/login` | — | — | Вход, возвращает JWT |
| GET | `/auth/me` | ✅ | any | Текущий пользователь |
| PUT | `/auth/password` | ✅ | any | Смена пароля |

### POST /auth/register
```json
// Body
{ "name": "Анна", "email": "anna@mail.com", "password": "123456" }

// Response 201
{ "data": { "token": "...", "user": { "id", "name", "email", "role": "student" } } }
```

### POST /auth/register-teacher
Создаёт учителя. Требует `teacherSecret` совпадающий с `TEACHER_SECRET` в `.env`.  
Использовать через Postman — не публичный эндпоинт.

```json
// Body
{ "name": "Учитель", "email": "teacher@mail.com", "password": "пароль", "teacherSecret": "..." }

// Response 201
{ "data": { "token": "...", "user": { "id", "name", "email", "role": "teacher" } } }
```

### POST /auth/login
```json
// Body
{ "email": "anna@mail.com", "password": "123456" }

// Response 200
{ "data": { "token": "...", "user": { "id", "name", "email", "role" } } }
```

### PUT /auth/password
```json
// Body
{ "currentPassword": "старый", "newPassword": "новый" }

// Response 200
{ "data": { "message": "Пароль изменён" } }
```

---

## Analytics

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/analytics/teacher/:userId` | ✅ | any | Аналитика учителя (публичная) |
| GET | `/analytics/student/:id` | ✅ | own / связанный teacher | Аналитика студента |

### GET /analytics/teacher/:userId

Query: `?period=day|week|month` (default `month`)

Возвращает агрегаты для графиков:
- `revenueByPeriod` — два ряда `paid` (по `paidAt`) и `charged` (по `createdAt` платежа). `day` → 30 точек, `week` → 12, `month` → 6
- `studentsByMonth` — активные студенты по месяцам (последние 6). «Активен» = был Payment с этим month
- `avgAttendance` — общий % посещаемости по всем урокам учителя (число 0-100)
- `totals` — `{ students, groups, lessons }` для статов в профиле

```json
// Response 200
{
  "data": {
    "revenueByPeriod": [
      { "bucket": "2026-04", "paid": 1500, "charged": 1800 },
      { "bucket": "2026-05", "paid": 1200, "charged": 1600 }
    ],
    "studentsByMonth": [
      { "bucket": "2026-04", "count": 15 },
      { "bucket": "2026-05", "count": 17 }
    ],
    "avgAttendance": 87,
    "totals": { "students": 18, "groups": 5, "lessons": 234 }
  },
  "meta": { "period": "month" }
}

// Response 404 — если userId не существует или не teacher
{ "error": "Учитель не найден" }
```

### GET /analytics/student/:id

Доступ: сам студент ИЛИ его учитель (проверяется через GroupStudent/IndividualCourse).

```json
// Response 200
{
  "data": {
    "attendanceByMonth": [{ "bucket": "2026-04", "percent": 92 }],
    "homeworkStats":     { "submitted": 23, "total": 28, "percent": 82 },
    "grades": [
      { "at": "2026-05-14T10:23:00.000Z", "grade": 5, "homework": "Падежи: упражнения 1-5" }
    ],
    "totals": { "attendance": 91, "gradesAvg": 4.6, "lessonsAttended": 45 }
  }
}

// Response 403 — если запрашивающий не сам и не его учитель
{ "error": "Доступ запрещён" }
```

**`homeworkStats.percent`** считается только по ДЗ с прошедшим дедлайном — будущие задания не портят процент.

---

## Users

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/users` | ✅ | teacher | Список всех студентов |
| GET | `/users/:id` | ✅ | teacher / own | Профиль пользователя |
| PUT | `/users/:id` | ✅ | teacher / own | Обновить имя (email не меняется) |
| **PUT** | **`/users/me/profile`** | ✅ | any | **Обновить свой профиль (Instagram-поля)** |
| **GET** | **`/users/@:username/profile`** | ✅ | any | **Публичный профиль по username** |

### PUT /users/me/profile
Обновляет поля профиля текущего пользователя. Принимаются только перечисленные поля; остальное (email, password, role) игнорируется.

```json
// Body — все поля опциональны
{
  "name": "Иван Петров",
  "username": "ivan_petrov",
  "avatar": "https://res.cloudinary.com/.../avatar.jpg",
  "coverImage": "https://res.cloudinary.com/.../cover.jpg",
  "bio": "Преподаю польский 5 лет",
  "socialTelegram": "ivan_pl",
  "socialWhatsApp": "+48123456789",
  "socialLinkedIn": "ivan-petrov",
  "languages": [{ "code": "pl", "level": "C1" }, { "code": "en", "level": "B2" }]
}

// Response 200 — публичный профиль с новыми значениями
{ "data": { "id", "name", "username", "role", "avatar", "coverImage", "bio", "socialTelegram", "socialWhatsApp", "socialLinkedIn", "languages", "createdAt" } }
```

**Валидация:**
- `username`: `/^[a-z0-9_]{3,40}$/`, уникальность проверяется
- `bio`: до 300 символов
- `languages`: массив объектов с обязательным `code`; `level` опционален (для учителя — пусто)

### GET /users/@:username/profile
Возвращает публичный профиль любого пользователя. Доступ — все авторизованные. Аналитика отдаётся отдельным endpoint (Sprint B).

```
GET /users/@ivan_petrov/profile

// Response 200
{ "data": { "id", "name", "username", "role", "avatar", "coverImage", "bio", "socialTelegram", "socialWhatsApp", "socialLinkedIn", "languages", "createdAt" } }

// Response 404
{ "error": "Профиль не найден" }
```

### GET /users
```json
// Response 200
{ "data": [{ "id", "name", "email", "role": "student" }] }
```

### PUT /users/:id
```json
// Body — только name; email изменить нельзя
{ "name": "Новое имя" }
```

---

## Groups

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/groups` | ✅ | teacher/student | Список групп (teacher — все свои; student — свои) |
| POST | `/groups` | ✅ | teacher | Создать группу |
| GET | `/groups/:id` | ✅ | teacher / member | Группа + список студентов |
| PUT | `/groups/:id` | ✅ | teacher | Редактировать группу |
| DELETE | `/groups/:id` | ✅ | teacher | Удалить группу |
| POST | `/groups/:id/students` | ✅ | teacher | Добавить студента |
| DELETE | `/groups/:id/students/:studentId` | ✅ | teacher | Убрать студента |
| POST | `/groups/:id/generate-lessons` | ✅ | teacher | Массовая генерация уроков по расписанию |

### POST /groups
```json
// Body
{
  "name": "Группа A1",
  "schedule": [{ "day": 1, "time": "18:00" }, { "day": 3, "time": "18:00" }],
  "lessonLink": "https://zoom.us/j/xxx",
  "pricePerLesson": 300
}
// day: 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб

// Response 201
{ "data": { "id", "name", "schedule", "lessonLink", "pricePerLesson", "teacherId" } }
```

### POST /groups/:id/students
```json
// Body
{ "studentId": "uuid-студента" }
```

### POST /groups/:id/generate-lessons
Создаёт записи `Lesson` для каждого слота `Group.schedule` в диапазоне `[from, to]`.  
Идемпотентно: дубли по `(groupId, date, time)` не создаются — повторный вызов безопасен.  
Максимальный диапазон: 365 дней.

```json
// Body
{ "from": "2026-05-18", "to": "2026-06-15" }

// Response 200
{ "data": { "created": 9, "lessons": [{ "id", "groupId", "date", "time" }] } }
```

---

## Lessons (групповые уроки)

Все уроки — одинаковые записи независимо от способа создания (массово или вручную).  
Любой урок можно отдельно редактировать или удалить.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/lessons` | ✅ | teacher/student | Уроки (teacher — все своих групп; student — своих групп) |
| POST | `/lessons` | ✅ | teacher | Создать одиночный урок |
| GET | `/lessons/:id` | ✅ | teacher / member | Урок + материалы |
| PUT | `/lessons/:id` | ✅ | teacher | Редактировать |
| DELETE | `/lessons/:id` | ✅ | teacher | Удалить |

### POST /lessons
```json
// Body
{
  "groupId": "uuid",
  "date": "2026-05-20",
  "time": "18:00",
  "topic": "Глагол być",
  "description": "Разбираем спряжение",
  "lessonLink": null,
  "materials": [
    { "type": "link", "url": "https://...", "title": "Грамматика" },
    { "type": "text", "content": "Домашнее задание: стр. 15" },
    { "type": "file", "url": "https://cloudinary...", "title": "Worksheet.pdf" }
  ]
}
```

---

## Individual Courses (расписание индивидуальных занятий)

Контракт между учителем и студентом: расписание + цена + ссылка.  
Из него генерируются `IndividualLesson` по тому же принципу, что `Group` → `Lesson`.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/individual-courses` | ✅ | teacher/student | Список (teacher: свои; student: свои) |
| POST | `/individual-courses` | ✅ | teacher | Создать курс |
| GET | `/individual-courses/:id` | ✅ | teacher / own student | Курс |
| PUT | `/individual-courses/:id` | ✅ | teacher | Редактировать |
| DELETE | `/individual-courses/:id` | ✅ | teacher | Удалить (уроки остаются с `individualCourseId = null`) |
| POST | `/individual-courses/:id/generate-lessons` | ✅ | teacher | Массовая генерация уроков |

### POST /individual-courses
```json
// Body
{
  "studentId": "uuid",
  "name": "Анна — Польский B1",
  "schedule": [{ "day": 2, "time": "17:00" }],
  "lessonLink": "https://zoom.us/j/yyy",
  "pricePerLesson": 500
}

// Response 201
{ "data": { "id", "teacherId", "studentId", "name", "schedule", "lessonLink", "pricePerLesson" } }
```

### POST /individual-courses/:id/generate-lessons
Идемпотентно. Дубли по `(individualCourseId, date, time)` не создаются.  
Сгенерированные уроки наследуют `teacherId`, `studentId`, `lessonLink`, `pricePerLesson` из курса.  
Максимальный диапазон: 365 дней.

```json
// Body
{ "from": "2026-05-18", "to": "2026-06-15" }

// Response 200
{ "data": { "created": 4, "lessons": [...] } }
```

---

## Individual Lessons (индивидуальные уроки)

Отдельная запись урока — создаётся вручную или автоматически через `generate-lessons` курса.  
Любой урок можно отдельно редактировать или удалить.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/individual-lessons` | ✅ | teacher/student | Список (teacher: свои; student: свои) |
| POST | `/individual-lessons` | ✅ | teacher | Создать разовый урок |
| GET | `/individual-lessons/:id` | ✅ | teacher / own student | Урок |
| PUT | `/individual-lessons/:id` | ✅ | teacher | Редактировать |
| DELETE | `/individual-lessons/:id` | ✅ | teacher | Удалить |

### POST /individual-lessons
```json
// Body — individualCourseId необязателен (null для разовых уроков)
{
  "studentId": "uuid",
  "individualCourseId": null,
  "date": "2026-05-21",
  "time": "17:00",
  "topic": "Подготовка к экзамену",
  "description": "Работа над ошибками",
  "lessonLink": "https://zoom.us/j/yyy",
  "pricePerLesson": 500,
  "materials": [
    { "type": "link", "url": "https://...", "title": "Упражнения" }
  ]
}
```

### PUT /individual-lessons/:id
```json
// Body — любое поле опционально
{
  "topic": "Новая тема",
  "time": "18:00",
  "materials": [{ "type": "text", "content": "Правило падежей" }]
}
```

---

## Homework

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/homework` | ✅ | teacher/student | Список заданий |
| POST | `/homework` | ✅ | teacher | Создать задание |
| GET | `/homework/:id` | ✅ | teacher/student | Задание |
| PUT | `/homework/:id` | ✅ | teacher | Редактировать |
| DELETE | `/homework/:id` | ✅ | teacher | Удалить |
| POST | `/homework/:id/submit` | ✅ | **student** | Сдать ДЗ |
| GET | `/homework/:id/submissions` | ✅ | teacher | Все сдачи по заданию |
| PUT | `/homework/:id/submissions/:subId` | ✅ | teacher | Выставить оценку |

### POST /homework
```json
// Body — указывается одно из двух: lessonId или individualLessonId
{
  "lessonId": "uuid",
  "description": "Упражнение 3, стр. 20",
  "deadline": "2026-05-25T23:59:00Z"
}
```

### POST /homework/:id/submit
```json
// Body — fileUrl загружается на Cloudinary на фронте, бэкенд получает готовый URL
{ "fileUrl": "https://res.cloudinary.com/...", "comment": "Сделала все задания" }
```

### PUT /homework/:id/submissions/:subId
```json
// Body
{ "grade": 5 }
// Устанавливает status = 'graded'
```

---

## Attendance

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/attendance` | ✅ | teacher/student | Журнал (student — только своя) |
| POST | `/attendance` | ✅ | teacher | Выставить посещаемость (bulk) |
| PUT | `/attendance/:id` | ✅ | teacher | Исправить запись |

### POST /attendance
```json
// Body — указывается lessonId или individualLessonId
{
  "lessonId": "uuid",
  "records": [
    { "studentId": "uuid-1", "present": true },
    { "studentId": "uuid-2", "present": false }
  ]
}
```

### PUT /attendance/:id
```json
// Body
{ "present": true }
```

---

## Payments

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/payments` | ✅ | teacher/student | Оплаты (student — свои) |
| POST | `/payments/calculate` | ✅ | teacher | Рассчитать оплату за месяц |
| PUT | `/payments/:id` | ✅ | teacher | Отметить оплачено / нет |

### POST /payments/calculate
```json
// Body
{ "month": "2026-05" }

// Логика: для каждого студента каждой группы учителя:
//   amount = кол-во присутствий за месяц × group.pricePerLesson
// findOrCreate: не дублирует при повторном вызове, обновляет amount если изменился

// Response 200
{ "data": [{ "id", "studentId", "month", "amount", "paid", "paidAt" }] }
```

### PUT /payments/:id
```json
// Body
{ "paid": true }
// paid=true  → paidAt = NOW()
// paid=false → paidAt = null
```

---

## HTTP коды

| Код | Когда |
|-----|-------|
| 200 | OK |
| 201 | Создан |
| 400 | Неверные данные в запросе |
| 401 | Токен не предоставлен / недействителен |
| 403 | Недостаточно прав |
| 404 | Ресурс не найден |
| 500 | Внутренняя ошибка сервера |
