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
| POST | `/auth/register` | — | — | Регистрация студента (access в теле + refresh-cookie) |
| POST | `/auth/register-teacher` | — | — | **Открытая** регистрация учителя (без `teacherSecret`) |
| POST | `/auth/login` | — | — | Вход: access-JWT в теле + refresh в httpOnly-cookie |
| POST | `/auth/refresh` | cookie | — | Refresh-cookie → **новый access** (скользящее окно) |
| POST | `/auth/logout` | — | — | Гасит refresh-cookie |
| GET | `/auth/me` | ✅ | any | Текущий пользователь |
| PUT | `/auth/password` | ✅ | any | Смена пароля |
| GET | `/auth/verify-email?token=` | — | — | Подтверждение email (24ч TTL) |
| POST | `/auth/resend-verification` | ✅ | any | Повторная отправка письма верификации |
| POST | `/auth/forgot-password` | — | — | Отправить ссылку сброса пароля (всегда 200) |
| POST | `/auth/reset-password` | — | — | Новый пароль по токену (TTL 1ч) |

> **Токены (2026-07-01):** access-JWT **7д** — в теле ответа (`data.token`), фронт хранит в localStorage и шлёт `Authorization: Bearer`. Refresh-JWT **30д** — в **httpOnly-cookie** (`path=/api/v1/auth`), JS его не видит. Access истёк → фронт зовёт `/auth/refresh` (с `withCredentials`) → новый access → повторяет запрос. `/auth/logout` чистит cookie.

### POST /auth/register
```json
// Body
{ "name": "Анна", "email": "anna@mail.com", "password": "123456" }

// Response 201
{ "data": { "token": "...", "user": { "id", "name", "email", "role": "student" } } }
```

### POST /auth/register-teacher
**Открытая** регистрация учителя (после разворота — без `teacherSecret`).

```json
// Body
{ "name": "Учитель", "email": "teacher@mail.com", "password": "пароль" }

// Response 201 — + ставит refresh-cookie
{ "data": { "token": "<access>", "user": { "id", "name", "username", "email", "role": "teacher" } } }
```

### POST /auth/login
```json
// Body
{ "email": "anna@mail.com", "password": "123456" }

// Response 200 — access в теле, refresh в httpOnly-cookie
{ "data": { "token": "<access>", "user": { "id", "name", "username", "email", "role" } } }
```

### POST /auth/refresh
```
// Refresh-токен берётся из httpOnly-cookie (тело пустое, нужен withCredentials).
// Response 200
{ "data": { "token": "<новый access>" } }
// Response 401 — нет/невалиден refresh → фронт разлогинивает
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
- `revenueByPeriod` — два ряда `paid` (реальные деньги из `PaymentRecord` по `paidAt`) и `charged` (начислено/оборот из подтверждённых посещений по дате урока). `day` → 30 точек, `week` → 12, `month` → 6
- `studentsByMonth` — активные студенты по месяцам (последние 6). «Активен» = был на подтверждённом посещении (present=true) в этом месяце
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
| **GET** | **`/users/search?username=`** | ✅ | teacher | **C3: поиск учеников по ПОХОЖЕМУ нику/имени для приглашения** |

> ⏸️ `GET /users/@:username/profile` и `/:id/follow` — **размонтированы** (соц-слой запаркован, security H3). `GET /users` теперь **без email** (PII).

### GET /users/search?username=
Учитель ищет учеников по **похожему** нику ИЛИ имени (iLike `%q%`), `role='student'`, лимит 10, мин. 3 символа. Email **не** отдаётся. Возвращает **массив** (было точное совпадение/объект — изменено фиксом H1, 2026-07-01).

```
GET /users/search?username=stud

// Response 200 — список; alreadyMine:true если уже свой реальный ученик (Student{userId})
{ "data": [ { "id", "name", "username", "avatar", "alreadyMine": false } ] }
```

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
| POST | `/groups/:id/students` | ✅ | teacher | Добавить реального ученика (вход — `User.id`, гейт `TeacherStudent`) |
| POST | `/groups/:id/placeholder` | ✅ | teacher | Добавить заглушку (ученик без аккаунта) |
| DELETE | `/groups/:id/students/:studentId` | ✅ | teacher | Убрать ученика из группы (`studentId` = `Student.id`) |
| POST | `/groups/:id/generate-lessons` | ✅ | teacher | Массовая генерация уроков по расписанию |
| POST | `/groups/:id/invitations` | ✅ | teacher | C3: пригласить студента в группу (см. секцию Invitations) |

> **C1/C2:** ученик в группе — это запись **`Student`** (см. секцию Students). `GET /groups/:id` отдаёт `students[]` с полями `{ id (=Student.id), name, isPlaceholder, contact, email, username, avatar }` — для заглушки `isPlaceholder:true`, контакты из `contact`; для реального — из привязанного аккаунта.

### POST /groups
```json
// Body
{
  "name": "Группа A1",
  "schedule": [{ "day": 1, "time": "18:00" }, { "day": 3, "time": "18:00" }],
  "lessonLink": "https://zoom.us/j/xxx",
  "chatLink": "https://t.me/mygroup",
  "pricePerLesson": 300
}
// day: 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб
// chatLink — ссылка на внешний чат группы (TG/WA), опционально; PUT /groups/:id принимает то же

// Response 201
{ "data": { "id", "name", "schedule", "lessonLink", "chatLink", "pricePerLesson", "teacherId" } }
```

> **Уникальность урока:** `POST /lessons` и `POST /individual-lessons` отклоняют дубль по `(group/course, date, time)` с **409** «Урок на эту дату и время уже существует» (unique-индекс на уровне БД).

### POST /groups/:id/students
```json
// Body — studentId это User.id аккаунта (резолвится в Student-запись учителя)
{ "studentId": "uuid-аккаунта" }
```

### POST /groups/:id/placeholder
```json
// Body — заглушка (ученик без аккаунта), без гейта
{ "name": "Вася", "contact": "@vasya" }   // contact опционален
// Response 201: { "data": { "id", "name", "contact", "isPlaceholder": true } }
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

## Students (ученики-записи: заглушки + перенос)

**Модель (C1):** ученик — единая запись **`Student`** `{ id, teacherId, userId (nullable), name, contact }`, принадлежит учителю (per-teacher). `userId=null` → **заглушка** (только для учителя); `userId` заполнен → **реальный** (привязан к аккаунту). Все «студенческие» FK (`GroupStudent`/`IndividualCourse`/`IndividualLesson`/`Attendance`/`PaymentRecord`/`HomeworkSubmission`.`studentId`) ссылаются на `Student.id`.

Заглушки создаются через `POST /groups/:id/placeholder` (или ветка `placeholder` в `POST /individual-courses` и `/individual-lessons`). Посещаемость заглушки авто-`confirmed` (подтверждать некому). Долг/посещаемость считаются как у реального.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| POST | `/students/:id/merge` | ✅ | teacher | Перенести заглушку на реального ученика (история переезжает, заглушка удаляется) |
| DELETE | `/students/:id` | ✅ | teacher | Полностью удалить заглушку из ростера (с историей); реального — нельзя (403) |

### POST /students/:id/merge
`:id` — заглушка (своя, `userId=null`). Все её записи в 6 таблицах перепривязываются на `targetStudentId` (реальный, свой), конфликты unique разрешаются «оставить target, отбросить дубль заглушки», затем заглушка удаляется. Всё в транзакции.
```json
// Body
{ "targetStudentId": "uuid-реального-Student" }
// Response 200: { "data": { "merged": true, "moved": 5, "skipped": 1 } }
```

### DELETE /students/:id
Удаляет заглушку и всю её историю (явный снос детей по реестру FK + сама запись, в транзакции). Защита: только `userId IS NULL` — реального ученика так удалить нельзя (403).

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
| POST | `/homework/:id/quiz-attempt` | ✅ | student/teacher | Пройти прикреплённый тест (ответы+результат; вопросы с сервера) |
| GET | `/homework/:id/quiz-attempts` | ✅ | teacher | Прохождения теста учениками (с ответами) |

> ДЗ может иметь прикреплённый тест: `POST/PUT /homework` принимают `quizId` (тест из библиотеки учителя, `Quiz` c `!taken`). `GET /homework` и `/homework/:id` возвращают `quiz` (id/topic/type/questions). Прохождение сохраняется как `Quiz`-строка (владелец=проходивший, `homeworkId` set) → видно в «Мои тесты» ученика и в `quiz-attempts` учителя.

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

Новая модель (с 2026-06-22): помесячная система `Payment` удалена. **Долг считается живьём** из подтверждённых посещений (`charged`), факт оплаты — отдельные строки в `PaymentRecord` (`paid`). `balance = charged − paid`.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/payments/debt` | ✅ | student | Мой долг по каждому учителю (только approved засчитаны) |
| GET | `/payments/my-history` | ✅ | student | Моя история оплат (`?status=pending\|approved\|rejected`) + сводка |
| DELETE | `/payments/:id` | ✅ | student | Отменить свою заявку, пока `pending` (source='student') |
| GET | `/payments/debts` | ✅ | teacher | Долг каждого моего ученика |
| GET | `/payments/history` | ✅ | teacher | История оплат (`?status=`) + детали (скрин/причина/статус) |
| GET | `/payments/pending` | ✅ | teacher | Оплаты учеников на проверке (со скрином) |
| PATCH | `/payments/:id/approve` | ✅ | teacher | Подтвердить оплату (идёт в долг) |
| PATCH | `/payments/:id/reject` | ✅ | teacher | Отклонить оплату (body `{reason?}`) |
| POST | `/payments/record` | ✅ | teacher | Внести оплату от ученика (сразу approved) |
| POST | `/payments/student-pay` | ✅ | student | Ученик подаёт оплату со скрином (создаётся `pending`) |

### GET /payments/debt (студент)
```json
// studentId берётся из токена
// Response 200 — массив по каждому учителю
{ "data": [{ "teacher": { "id", "name", "email" }, "charged", "paid", "balance" }] }
// charged — сумма цен подтверждённых посещений (present=true)
// paid    — сумма PaymentRecord от этого студента этому учителю
```

### GET /payments/my-history (студент)
```json
// Query (все опциональны): ?method=cash|card|transfer|online&from=YYYY-MM-DD&to=YYYY-MM-DD
// studentId(ы) берутся из токена (getStudentIdsForUser); сортировка по paidAt DESC
// Response 200
{
  "data": [{ "id", "amount", "method", "source", "paidAt", "teacher": { "id", "name" } }],
  "summary": { "total": 450, "byMethod": { "cash": 300, "transfer": 150 } }
}
// Показывает КОМУ платил (teacher), в отличие от учительской /history (показывает student)
```

### GET /payments/debts (учитель)
```json
// teacherId берётся из токена
// Response 200 — массив по каждому ученику
{ "data": [{ "student": { "id", "name", "email" }, "charged", "paid", "balance" }] }
```

### GET /payments/history (учитель)
```json
// Query (все опциональны): ?studentId=<uuid>&method=cash|card|transfer|online&from=YYYY-MM-DD&to=YYYY-MM-DD
// teacherId берётся из токена; список только своих оплат, сортировка по paidAt DESC
// Response 200
{
  "data": [{ "id", "amount", "method", "source", "paidAt", "student": { "id", "name" } }],
  "summary": { "total": 450, "byMethod": { "cash": 300, "card": 150 } }
}
// summary считается в рамках текущего фильтра
```

### Модерация оплат ученика (2026-07-11)
`PaymentRecord.status`: `pending` → `approved` / `rejected`. **В долг засчитываются только `approved`** (все агрегации `paid` фильтруют по статусу: `getDebt`, `fetchChargesAndPayments`, `getStudentDebtTotal`, analytics revenue, admin stats).
- Ученик `POST /payments/student-pay` → создаётся `status='pending'` (source='student', со `screenshotUrl`), долг **не** уменьшается; учителю летит уведомление `payment_submitted`.
- Учитель `GET /payments/pending` видит очередь со скрином; `PATCH /:id/approve` → `approved` (долг уменьшается, уведомление `payment_approved`); `PATCH /:id/reject {reason?}` → `rejected` (`rejectionReason`, уведомление `payment_rejected`).
- Ученик `DELETE /:id` отменяет свою заявку, пока `pending`.
- История (обе роли) принимает `?status=` и отдаёт `screenshotUrl`/`status`/`rejectionReason`/`reviewedAt`.

**Способы оплаты (2026-07-12):** ENUM `method` расширен — базовые `cash/card/transfer` + доп.каналы `blik/paypal/revolut/other` (`online` — легаси). Ученик при оплате видит только каналы, которые учитель заполнил в `paymentDetails` (iban→transfer, blik, paypal, revolut, customLabel→other). Разбивка «по способам» на странице финансов = базовые 3 + доп.каналы учителя + всё, где реально были оплаты. Миграция `20260712000001` (`ALTER TYPE ADD VALUE`). BLIK — отдельный способ (польская специфика), не «карта».

### POST /payments/record (учитель)
```json
// Body (Zod recordPaymentSchema)
{ "studentId": "<uuid>", "amount": 150, "method": "cash" }
// amount > 0; method ∈ cash|card|transfer|online (опц., по умолчанию cash); source='manual' (сервер)
// Проверка: studentId должен быть учеником ростера учителя (Student.teacherId).
// teacherId и paidAt проставляет сервер.

// Response 201
{ "data": { "id", "studentId", "teacherId", "amount", "method", "source", "paidAt" } }
```

---

## AI-тесты (генератор + сохранённые тесты)

Генерация — через OpenAI-совместимый провайдер (по умолчанию Groq, ключ `AI_API_KEY` в .env; нет ключа → 503). Сохранённые тесты — модель `Quiz` (JSONB `questions`), только свои.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| POST | `/ai/quiz` | ✅ | teacher | Сгенерировать тест по теме (не сохраняет) |
| GET | `/quizzes` | ✅ | teacher | Мои сохранённые тесты (мета + count) |
| GET | `/quizzes/:id` | ✅ | teacher | Полный тест (с вопросами), только свой |
| POST | `/quizzes` | ✅ | teacher | Сохранить тест |
| DELETE | `/quizzes/:id` | ✅ | teacher | Удалить свой тест |

```json
// POST /ai/quiz — Body (Zod quizSchema)
{ "topic": "Дроби", "count": 5, "difficulty": "medium", "type": "single", "language": "русский" }
// type ∈ single|multiple|truefalse|open. Response 200:
{ "data": { "topic","type",..., "questions": [ { "question","options":[],"answer":[0],"sampleAnswer","explanation" } ] } }

// POST /quizzes — Body: { topic, type, difficulty?, language?, questions:[...] } → 201 { data: <Quiz> }
```

## Invitations (приглашения в группу, C3 механика B)
> Приглашение **учитель→ученик** в группу. Направление противоположно запаркованному `LessonRequest` (там ученик→учитель), поэтому отдельная модель.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| POST | `/groups/:id/invitations` | ✅ | teacher | Пригласить студента (по `User.id`) в группу |
| GET | `/invitations` | ✅ | teacher/student | Список (роль-свитч: учитель — исходящие, студент — входящие); фильтр `?status=` |
| PATCH | `/invitations/:id` | ✅ | student | Принять (`accepted`) или отклонить (`declined`) приглашение |

### POST /groups/:id/invitations
```json
// Body
{ "inviteeUserId": "<uuid>" }   // приглашаемый студент (User.id)

// Если ученик УЖЕ свой реальный (есть Student{userId} у этого учителя) —
// добавляется в группу напрямую, без Invitation:
// Response 201
{ "data": { "directAdd": true, "message": "Студент уже ваш — добавлен в группу без приглашения" } }

// Иначе создаётся приглашение:
// Response 201
{ "data": { "id", "teacherId", "groupId", "inviteeUserId", "status": "pending" } }

// Ошибки: 404 группа не найдена / не студент; 403 чужая группа;
//         400 уже в группе / приглашение уже отправлено (анти-дубль pending)
```

### GET /invitations
```json
// Учитель видит исходящие (include invitee+Group), студент — входящие (include teacher+Group)
// ?status=pending|accepted|declined|revoked — опциональный фильтр
{ "data": [{ "id", "teacherId", "groupId", "inviteeUserId", "status", "teacher"|"invitee", "Group" }] }
```

### PATCH /invitations/:id
```json
// Body (Zod patchInvitation)
{ "status": "accepted" }   // или "declined"

// Только сам приглашённый (inviteeUserId === me) и только из статуса pending.
// accept в транзакции: resolveStudent → членство в группе (GroupStudent) →
//   связь TeacherStudent (гейт оставлен параллельно).
// Response 200
{ "data": { "id", "status": "accepted", ... } }

// Ошибки: 404 не найдено; 403 не своё приглашение / не student;
//         400 уже обработано (status != pending)
```

---

## Admin ✅ (2026-07-09)

Все эндпоинты за `auth + isAdmin`. `isTeacher` пропускает admin.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/admin/stats` | ✅ | admin | KPI платформы (учителя/студенты/группы/уроки/выручка) |
| GET | `/admin/teachers` | ✅ | admin | Список учителей с тарифом и статусом |
| GET | `/admin/users` | ✅ | admin | Все пользователи; фильтр `?role=&active=` |
| PATCH | `/admin/users/:id/deactivate` | ✅ | admin | Деактивировать пользователя (нельзя другого admin) |
| PATCH | `/admin/users/:id/activate` | ✅ | admin | Восстановить доступ |
| PATCH | `/admin/users/:id/role` | ✅ | admin | Сменить роль (teacher/student/admin); нельзя понизить себя |
| PATCH | `/admin/users/:id/plan` | ✅ | admin | Сменить тариф (только для teacher); free/pro/school |
| GET | `/admin/support` | ✅ | admin | Обращения в поддержку; фильтр `?status=&category=`; `meta.counts` по статусам |
| PATCH | `/admin/support/:id` | ✅ | admin | Ответить (email автору) + сменить статус |

```json
// GET /admin/stats → Response 200
{ "data": { "teachers": 12, "students": 145, "groups": 38, "lessons": 870, "revenue": 145000 } }

// PATCH /admin/users/:id/role — Body
{ "role": "admin" }

// PATCH /admin/users/:id/plan — Body
{ "plan": "pro" }

// PATCH /admin/support/:id — Body (Zod updateTicket)
{ "status": "resolved", "adminReply": "Текст ответа" }
// adminReply (опц.) → шлёт письмо на email автора (best-effort) + ставит repliedAt;
// если задан adminReply без status → статус ставится 'resolved'.
```

---

## Support (обращения в поддержку)

Публичная форма (гость или залогиненный) + ответ из админки по email.

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| POST | `/support/ticket` | — (optionalAuth) | — | Создать обращение (rate-limit 3/час на IP) |

```json
// POST /support/ticket — Body (Zod createTicket)
{ "name": "Аня", "email": "anna@mail.com", "subject": "Не приходит письмо", "category": "problem", "message": "..." }
// category ∈ question|problem|billing (опц., по умолчанию question)
// optionalAuth: если запрос авторизован — привяжется userId; гость тоже может писать.
// Response 201
{ "data": { "id": "<uuid>" } }
```

Модель `SupportTicket`: `{ id, userId?, name, email, subject, category, message, status(open|in_progress|resolved), adminReply?, repliedAt?, createdAt }`.

---

## Notifications (in-app уведомления)

Создаются автоматически на события (новое ДЗ, оценка, оплата, приглашение, посещаемость). Email-канал — позже (нужен домен).

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/notifications` | ✅ | any | Мои (последние 50); `?unread=true` — только непрочитанные; `meta.unreadCount` |
| PATCH | `/notifications/:id/read` | ✅ | any | Отметить одно прочитанным |
| PATCH | `/notifications/read-all` | ✅ | any | Отметить все прочитанными |

```json
// GET /notifications → Response 200
{ "data": [{ "id","type","title","body","link","readAt","createdAt" }], "meta": { "unreadCount": 3 } }
```

Типы: `homework_assigned` (студентам группы при создании ДЗ), `homework_graded` (ученику при оценке), `attendance_pending` (студентам при отметке посещения), `invitation_received` (приглашённому), `payment_recorded` (ученику при внесении оплаты). Хелпер `utils/notify.js` (`createNotification`, `notifyMany`) — best-effort, не блокирует основной поток.

## Student self-service (личный кабинет ученика)

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/vocab` | ✅ | student | Словарь (фильтр `?status=`, пагинация) + `meta.counts` |
| GET | `/vocab/due` | ✅ | student | Слова к повторению сегодня (SR) |
| POST | `/vocab` | ✅ | student | Добавить слово |
| PUT | `/vocab/:id` | ✅ | student | Редактировать |
| PATCH | `/vocab/:id/review` | ✅ | student | Результат повторения `{correct}` (SR-интервал) |
| DELETE | `/vocab/:id` | ✅ | student | Удалить |
| GET | `/my-lessons` | ✅ | student | Журнал внешних/самостоятельных занятий (фильтры) |
| GET | `/my-lessons/stats` | ✅ | student | Сводка: занятий/часов/долг/оплачено + разбивки |
| POST/PUT/DELETE | `/my-lessons/:id?` | ✅ | student | CRUD записей |
| PATCH | `/my-lessons/:id/pay` | ✅ | student | Отметить оплаченным |
| GET/POST | `/notes` | ✅ | student | Заметки (фильтр `?lessonId=`) |
| PUT/DELETE | `/notes/:id` | ✅ | student | Редактировать/удалить заметку |
| GET | `/students/me/progress` | ✅ | student | Прогресс-центр: streak, активность по дням, словарь, внешние занятия |
| GET | `/materials` | ✅ | any | Материалы уроков (role-switch: свои/доступные) |

## Dashboard

| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/dashboard` | ✅ | any | KPI для текущей роли (teacher / student) |
| GET | `/dashboard/activity` | ✅ | any | Лента последних событий |

```json
// GET /dashboard (teacher) → Response 200
{ "data": { "studentsCount", "lessonsThisWeek", "totalDebt", "avgAttendance", "todayLessons": [], "upcomingLessons": [] } }

// GET /dashboard (student) → Response 200
{ "data": { "lessonsThisWeek", "pendingHomework", "attendance", "debt", "homeworkList": [], "recentGrades": [] } }

// GET /dashboard/activity → Response 200
{ "data": [{ "type": "submission"|"payment"|"attendance", "text": "...", "at": "ISO" }] }
```

---

## Teachers (каталог) ⏸️ ЗАПАРКОВАНО
> Соц/маркетплейс, вынесено из teacher-first ([REVISION.md](../../REVISION.md)). Эндпоинт смонтирован, но фронт удалён — переедет в отдельный сервис.


| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/teachers/catalog` | ✅ | any | Каталог учителей: фильтр по языку, поиск, пагинация |

### GET /teachers/catalog
```
Query: ?page=&limit=&language=<code>&q=<строка>   (все опциональны)
- language — code из LANGUAGES (pl/en/…); матч по JSONB languages @> [{code}]
- q        — iLike по name ИЛИ username
- сортировка: по числу учеников DESC, затем createdAt DESC
```
```json
// Response 200
{
  "data": [{ "id", "name", "username", "avatar", "bio",
             "languages": [{ "code", "level?" }],
             "studentsCount", "followersCount" }],
  "pagination": { "page", "limit", "total", "pages" }
}
// studentsCount/followersCount приходят строками (SQL COUNT) — приводить Number() на фронте
```

---

## Posts / Feed (лента) ⏸️ ЗАПАРКОВАНО
> Соц-фича, вынесена из teacher-first ([REVISION.md](../../REVISION.md)). Эндпоинты смонтированы, но фронт удалён — переедет в отдельный сервис.


| Method | Path | Auth | Role | Описание |
|--------|------|------|------|----------|
| GET | `/feed` | ✅ | any | Лента: ранжированная выдача, офсет-курсор. Инкрементит просмотры |
| GET | `/posts?authorId=` | ✅ | any | Посты автора (таб профиля), до 20, без инкремента |
| POST | `/posts` | ✅ | any | Создать пост (текст + media[]) |
| DELETE | `/posts/:id` | ✅ | author | Удалить свой пост (403 чужому); лайки сносятся каскадом |
| POST | `/posts/:id/like` | ✅ | any | Лайкнуть (идемпотентно) |
| DELETE | `/posts/:id/like` | ✅ | any | Снять лайк |

### POST /posts
```json
// Body
{ "text": "строка 1..5000", "media": ["https://...", ...] }  // media опционально, ≤10 URL
```

### GET /feed
```
Query: ?cursor=&limit=   (limit 1..50, default 10)
- cursor — непрозрачная строка (base64 офсета в ранжированном окне); из nextCursor предыдущего ответа
- ранжирование: окно последних 200 постов скорится в JS —
  свежесть (time-decay, τ=48ч) + вовлечённость (лайки/просмотры)
  + совпадение языков зрителя↔автора + буст подписок/своих учителей
```
```json
// Response 200
{
  "data": [{
    "id", "text", "media": [], "viewsCount", "createdAt",
    "author": { "id", "name", "username", "avatar", "role" },
    "likesCount", "likedByMe"
  }],
  "nextCursor": "<строка|null>"   // null = постов больше нет
}
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
