# Архитектура проекта

## Стек

| Слой | Технология |
|------|-----------|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| ORM | Sequelize 6 |
| БД | PostgreSQL |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Файлы | Cloudinary |
| Env | dotenvx (пакет `dotenv` v17) |
| Dev | nodemon |
| Хостинг | Railway |

---

## Структура файлов

```
polish-school/
├── index.js                        # точка входа: запускает сервер, connectsDB
├── src/
│   ├── app.js                      # Express app: middleware + подключение роутов
│   ├── config/
│   │   └── database.js             # Sequelize instance (читает DB_URL из env)
│   ├── models/
│   │   ├── index.js                # импорт всех моделей + все ассоциации
│   │   ├── User.js
│   │   ├── Group.js
│   │   ├── GroupStudent.js
│   │   ├── Lesson.js
│   │   ├── IndividualLesson.js
│   │   ├── Homework.js
│   │   ├── HomeworkSubmission.js
│   │   ├── Attendance.js
│   │   └── Payment.js
│   ├── middleware/
│   │   ├── auth.js                 # JWT проверка → req.user = { id, role }
│   │   └── role.js                 # isTeacher / isStudent guards
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── group.routes.js
│   │   ├── lesson.routes.js
│   │   ├── individualLesson.routes.js
│   │   ├── homework.routes.js
│   │   ├── attendance.routes.js
│   │   └── payment.routes.js
│   └── controllers/
│       ├── auth.controller.js
│       ├── user.controller.js
│       ├── group.controller.js
│       ├── lesson.controller.js
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
├── .env                            # переменные окружения (UTF-8, не коммитить)
├── .gitignore
├── CLAUDE.md
└── package.json
```

---

## Поток запроса

```
HTTP Request
    │
    ▼
app.js (cors, express.json)
    │
    ▼
routes/*.routes.js
    │
    ├── middleware/auth.js      ← проверяет JWT, добавляет req.user
    ├── middleware/role.js      ← проверяет role (isTeacher / isStudent)
    │
    ▼
controllers/*.controller.js
    │
    ├── models/index.js         ← Sequelize модели
    │       │
    │       ▼
    │   PostgreSQL (DB_URL)
    │
    ▼
res.json({ data }) / res.json({ error })
```

---

## Модели и связи

```
User ─────────────────── Group           (teacher: 1 → many)
User ─── GroupStudent ── Group           (students: many ↔ many)

Group ──────────────── Lesson            (1 → many)
User ────────────────── IndividualLesson  (teacher + student: each 1 → many)

Lesson ─────────────── Homework          (1 → many, nullable)
IndividualLesson ────── Homework         (1 → many, nullable)

Homework ────────────── HomeworkSubmission (1 → many)
User ────────────────── HomeworkSubmission (student)

Lesson ─────────────── Attendance        (nullable)
IndividualLesson ────── Attendance       (nullable)
User ────────────────── Attendance       (student)

User ────────────────── Payment          (student)
```

---

## Env переменные

```env
PORT=5000
NODE_ENV=development

JWT_SECRET=<64+ символов>
JWT_EXPIRES_IN=7d

DB_URL=postgresql://user:pass@host:5432/polish_school

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> **Важно:** файл `.env` должен быть в кодировке **UTF-8 без BOM**.  
> На Windows писать через PowerShell: `[System.IO.File]::WriteAllText(path, content, [Text.Encoding]::UTF8)`

---

## Запуск

```bash
# разработка
npm run dev       # nodemon index.js

# продакшн
npm start         # node index.js
```

При старте `index.js`:
1. Загружает `.env` через dotenvx
2. Вызывает `sequelize.authenticate()` — проверяет соединение с БД
3. Вызывает `sequelize.sync({ alter: true })` — синхронизирует схему
4. Запускает `app.listen(PORT)`

---

## Cloudinary (загрузка файлов)

Фронтенд сам загружает файл на Cloudinary и получает URL.  
Бэкенд принимает готовый `fileUrl` в теле запроса — не хранит бинарные данные.

Используется в:
- `HomeworkSubmission.fileUrl` — сданное ДЗ
- `Lesson.materials[].url` — файловые материалы урока (type: 'file')
