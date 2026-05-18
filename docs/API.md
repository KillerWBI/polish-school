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
| POST | `/auth/register` | — | — | Регистрация (создаёт student) |
| POST | `/auth/login` | — | — | Вход, возвращает token |
| GET | `/auth/me` | ✅ | any | Текущий пользователь |

### POST /auth/register
```json
// Body
{ "name": "Анна", "email": "anna@mail.com", "password": "123456" }

// Response 201
{ "data": { "token": "...", "user": { "id", "name", "email", "role": "student" } } }
```

### POST /auth/login
```json
// Body
{ "email": "anna@mail.com", "password": "123456" }

// Response 200
{ "data": { "token": "...", "user": { "id", "name", "email", "role" } } }
```

### GET /auth/me
```json
// Response 200
{ "data": { "id", "name", "email", "role" } }
```

---

## Users

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/users` | ✅ | teacher | Список всех студентов |
| GET | `/users/:id` | ✅ | teacher / own | Профиль пользователя |
| PUT | `/users/:id` | ✅ | teacher / own | Обновить имя/email |

### GET /users
```json
// Response 200
{ "data": [{ "id", "name", "email", "role": "student" }] }
```

### PUT /users/:id
```json
// Body (любое поле опционально)
{ "name": "Новое имя", "email": "new@mail.com" }
```

---

## Groups

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/groups` | ✅ | teacher/student | Список групп (teacher — все свои, student — свои) |
| POST | `/groups` | ✅ | teacher | Создать группу |
| GET | `/groups/:id` | ✅ | teacher / member | Группа + список студентов |
| PUT | `/groups/:id` | ✅ | teacher | Редактировать группу |
| DELETE | `/groups/:id` | ✅ | teacher | Удалить группу |
| POST | `/groups/:id/students` | ✅ | teacher | Добавить студента |
| DELETE | `/groups/:id/students/:studentId` | ✅ | teacher | Убрать студента |

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

---

## Lessons (групповые уроки)

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/lessons` | ✅ | teacher/student | Уроки (teacher — все своих групп, student — своих групп) |
| POST | `/lessons` | ✅ | teacher | Создать урок |
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

## Individual Lessons (индивидуальные уроки)

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/individual-lessons` | ✅ | teacher/student | Список (teacher — все свои, student — свои) |
| POST | `/individual-lessons` | ✅ | teacher | Создать |
| GET | `/individual-lessons/:id` | ✅ | teacher / own student | Урок |
| PUT | `/individual-lessons/:id` | ✅ | teacher | Редактировать |
| DELETE | `/individual-lessons/:id` | ✅ | teacher | Удалить |

### POST /individual-lessons
```json
// Body
{
  "studentId": "uuid",
  "date": "2026-05-21",
  "time": "17:00",
  "topic": "Подготовка к экзамену",
  "lessonLink": "https://zoom.us/j/yyy",
  "pricePerLesson": 500
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
| POST | `/homework/:id/submit` | ✅ | student | Сдать ДЗ (Cloudinary URL) |
| GET | `/homework/:id/submissions` | ✅ | teacher | Все сдачи по заданию |
| PUT | `/homework/:id/submissions/:subId` | ✅ | teacher | Выставить оценку |

### POST /homework
```json
// Body — одно из двух: lessonId или individualLessonId
{
  "lessonId": "uuid",
  "description": "Упражнение 3, стр. 20",
  "deadline": "2026-05-25T23:59:00Z"
}
```

### POST /homework/:id/submit
```json
// Body — fileUrl приходит уже готовым (загрузка на Cloudinary на фронте)
{ "fileUrl": "https://res.cloudinary.com/...", "comment": "Сделала все задания" }
```

### PUT /homework/:id/submissions/:subId
```json
// Body
{ "grade": 5 }
```

---

## Attendance

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/attendance` | ✅ | teacher/student | Журнал (student — только своя) |
| POST | `/attendance` | ✅ | teacher | Выставить посещаемость для урока |
| PUT | `/attendance/:id` | ✅ | teacher | Исправить запись |

### POST /attendance
```json
// Body — массовое выставление для урока
{
  "lessonId": "uuid",
  "records": [
    { "studentId": "uuid-1", "present": true },
    { "studentId": "uuid-2", "present": false }
  ]
}
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
// amount = кол-во присутствий за месяц × group.pricePerLesson
// Создаёт или обновляет Payment записи

// Response 200
{ "data": [{ "id", "studentId", "month", "amount", "paid", "paidAt" }] }
```

### PUT /payments/:id
```json
// Body
{ "paid": true }
// Если paid=true, устанавливает paidAt = now()
// Если paid=false, обнуляет paidAt
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
