# Архитектура проекта

## Стек

| Слой | Технология |
|------|-----------|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| ORM | Sequelize 6 |
| БД | PostgreSQL (Railway) |
| Auth | JWT — `jsonwebtoken` + `bcryptjs`, 7 дней |
| Файлы | Cloudinary (фронт загружает, бэк получает URL) |
| Env | `dotenv` v17 (на деле — dotenvx) |
| Dev | nodemon |
| Хостинг | Railway (backend + PostgreSQL) |

---

## Структура файлов

```
polish-school/
├── index.js                            # точка входа: dotenv → authenticate → sync → listen
├── src/
│   ├── app.js                          # Express: cors + json + 9 роутов + error handler
│   ├── config/
│   │   └── database.js                 # Sequelize(DB_URL), require('dotenv').config() внутри
│   ├── models/
│   │   ├── index.js                    # все модели + все ассоциации
│   │   ├── User.js
│   │   ├── Group.js
│   │   ├── GroupStudent.js
│   │   ├── Lesson.js
│   │   ├── IndividualCourse.js         # расписание индивид. занятий (teacher ↔ student)
│   │   ├── IndividualLesson.js         # конкретный индивид. урок
│   │   ├── Homework.js
│   │   ├── HomeworkSubmission.js
│   │   ├── Attendance.js
│   │   └── Payment.js
│   ├── middleware/
│   │   ├── auth.js                     # JWT → req.user = { id, role }
│   │   └── role.js                     # isTeacher / isStudent guards
│   ├── utils/
│   │   └── lessonGenerator.js          # expandSchedule, generateGroupLessons, generateIndividualLessons
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── group.routes.js
│   │   ├── lesson.routes.js
│   │   ├── individualCourse.routes.js
│   │   ├── individualLesson.routes.js
│   │   ├── homework.routes.js
│   │   ├── attendance.routes.js
│   │   └── payment.routes.js
│   └── controllers/
│       ├── auth.controller.js
│       ├── user.controller.js
│       ├── group.controller.js
│       ├── lesson.controller.js
│       ├── individualCourse.controller.js
│       ├── individualLesson.controller.js
│       ├── homework.controller.js
│       ├── attendance.controller.js
│       └── payment.controller.js
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── MODULES.md
│   ├── PROGRESS.md
│   └── ROLES.md
├── .env                                # UTF-8 без BOM (8 переменных)
├── .gitignore                          # node_modules/ + .env
├── CLAUDE.md
└── package.json
```

---

## Поток запроса

```
HTTP Request
    │
    ▼
app.js  (cors, express.json)
    │
    ▼
routes/*.routes.js
    │
    ├── middleware/auth.js      ← проверяет JWT, добавляет req.user = { id, role }
    ├── middleware/role.js      ← isTeacher / isStudent (403 если не та роль)
    │
    ▼
controllers/*.controller.js
    │
    ├── models/index.js         ← Sequelize модели + ассоциации
    │       │
    │       ▼
    │   PostgreSQL (DB_URL)
    │
    ├── utils/lessonGenerator.js  ← только для generate-lessons эндпоинтов
    │
    ▼
res.json({ data }) / res.json({ error })
```

---

## Модели и связи

```
User ─────────────────── Group                   (teacher: 1 → many)
User ─── GroupStudent ── Group                   (students: many ↔ many)

Group ──────────────── Lesson                    (1 → many)

User ────────────────── IndividualCourse          (teacher: 1 → many)
User ────────────────── IndividualCourse          (student: 1 → many)
IndividualCourse ────── IndividualLesson          (1 → many, FK nullable)

User ────────────────── IndividualLesson          (teacher + student, для разовых)

Lesson ─────────────── Homework                  (1 → many, nullable FK)
IndividualLesson ────── Homework                  (1 → many, nullable FK)

Homework ────────────── HomeworkSubmission        (1 → many)
User ────────────────── HomeworkSubmission        (student)

Lesson ─────────────── Attendance                (nullable FK)
IndividualLesson ────── Attendance               (nullable FK)
User ────────────────── Attendance               (student)

User ────────────────── Payment                  (student)
```

### Принцип уроков

- `Group.schedule` (JSONB) хранит повторяющееся расписание.
- `POST /groups/:id/generate-lessons` создаёт `Lesson` записи по этому расписанию за период.
- `IndividualCourse.schedule` — то же для индивидуальных.
- `POST /individual-courses/:id/generate-lessons` создаёт `IndividualLesson` записи.
- **Все уроки одинаковые** — независимо от способа создания (пакетно или вручную).
- Любой урок редактируется (`PUT`) или удаляется (`DELETE`) по отдельности.
- Генерация идемпотентна: повторный вызов за тот же период не дублирует уроки.

---

## Переменные окружения (.env)

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=<64+ символов, случайная строка>
JWT_EXPIRES_IN=7d

DB_URL=postgresql://user:pass@host:PORT/railway

TEACHER_SECRET=<секрет для POST /auth/register-teacher>

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> **Важно:** файл `.env` должен быть в кодировке **UTF-8 без BOM**.  
> На Windows записывать через PowerShell:  
> `[System.IO.File]::WriteAllText(path, content, [System.Text.Encoding]::UTF8)`

---

## Запуск

```bash
npm run dev     # nodemon index.js
npm start       # node index.js
```

При старте `index.js`:
1. `require('dotenv').config()` — загружает `.env`
2. `sequelize.authenticate()` — проверяет соединение с БД
3. `sequelize.sync({ alter: true })` — синхронизирует схему (добавляет новые колонки, не удаляет данные)
4. `app.listen(PORT)` — запускает сервер

> Также `database.js` и `app.js` вызывают `require('dotenv').config()` — это нужно, потому что модели загружаются до того, как `index.js` успевает инициализировать переменные.

---

## Cloudinary

Фронтенд сам загружает файл на Cloudinary и получает URL.  
Бэкенд принимает готовый `fileUrl` — никогда не хранит бинарные данные.

Используется в:
- `HomeworkSubmission.fileUrl` — сданное ДЗ
- `Lesson.materials[].url` — файловые материалы урока (type: 'file')
- `IndividualLesson.materials[].url` — то же для индивидуальных уроков
