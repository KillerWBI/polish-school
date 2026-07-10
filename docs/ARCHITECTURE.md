# Архитектура проекта — Backend

**Обновлено 2026-07-09.**

## Стек

| Слой | Технология |
|------|-----------|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| ORM | Sequelize 6 |
| БД | PostgreSQL (Railway) |
| Auth | JWT (access 1h httpOnly + refresh cookie 30д) |
| Файлы | Cloudinary (фронт загружает, бэк получает URL) |
| Email | Resend (верификация, сброс пароля, напоминания) |
| AI | Groq API (генерация тестов) |
| Валидация | Zod 4 (`schemas/*.schema.js` + `middleware/validate.js`) |
| Безопасность | helmet, rate-limit, timing-safe bcrypt |
| Мониторинг | Sentry (`instrument.js`, off без DSN) |
| Хостинг | Railway (backend + PostgreSQL) |

---

## Структура файлов

```
polish-school/
├── index.js                            # dotenv → Sentry → authenticate → sync/migrate → bootstrapAdmin → listen
├── instrument.js                       # Sentry init (импортируется первым)
├── src/
│   ├── app.js                          # Express: cors + json + роуты + error handler
│   ├── config/
│   │   ├── database.js                 # Sequelize(DB_URL)
│   │   └── sequelize-config.js         # для sequelize-cli (db:migrate)
│   ├── models/
│   │   ├── index.js                    # все модели + ассоциации
│   │   ├── User.js                     # role ENUM(teacher/student/admin), active, paymentDetails JSONB, emailVerified, plan
│   │   ├── Student.js                  # teacherId, userId (nullable), name, contact
│   │   ├── Group.js                    # teacherId, schedule JSONB, chatLink, pricePerLesson
│   │   ├── GroupStudent.js             # groupId → Group, studentId → Student
│   │   ├── Lesson.js                   # groupId, unique(groupId,date,time)
│   │   ├── IndividualCourse.js         # teacherId → User, studentId → Student, schedule JSONB
│   │   ├── IndividualLesson.js         # courseId (nullable), teacherId, studentId → Student, unique(courseId,date,time)
│   │   ├── Homework.js                 # lessonId OR individualLessonId (взаимоисключающие)
│   │   ├── HomeworkSubmission.js       # studentId → Student, unique(homeworkId,studentId)
│   │   ├── Attendance.js               # studentId → Student, nullable lessonId/individualLessonId
│   │   ├── PaymentRecord.js            # studentId → Student, teacherId → User, amount, method, source ENUM, screenshotUrl
│   │   ├── Invitation.js               # teacherId, groupId, inviteeUserId, status ENUM (C3)
│   │   ├── Post.js                     # ⏸️ запаркован (соц-слой)
│   │   └── PostLike.js                 # ⏸️ запаркован
│   ├── middleware/
│   │   ├── auth.js                     # JWT → req.user; проверяет user.active (деактивация мгновенная)
│   │   ├── role.js                     # isTeacher (пропускает admin), isStudent, isAdmin
│   │   └── validate.js                 # validate(schema, 'body'|'query') → safeParse → req.body/validatedQuery
│   ├── schemas/
│   │   ├── auth.schema.js
│   │   ├── group.schema.js
│   │   ├── homework.schema.js
│   │   ├── lesson.schema.js
│   │   ├── payment.schema.js
│   │   └── student.schema.js
│   ├── utils/
│   │   ├── lessonGenerator.js          # expandSchedule, generateGroupLessons, generateIndividualLessons
│   │   ├── ownership.js                # isHwOwner({lessonId,individualLessonId}, teacherId) → boolean
│   │   ├── debtHelpers.js              # computeChargedByTeacher, fetchChargesAndPayments, getTeacherDebtTotal
│   │   ├── students.js                 # getStudentIdsForUser, resolveStudent, getTeacherStudentIds, createPlaceholder
│   │   └── studentFkRegistry.js        # реестр 6 FK для merge/удаления Student
│   ├── services/
│   │   ├── emailValidator.js           # MX DNS + disposable blacklist
│   │   └── emailService.js             # Resend (верификация, сброс, fallback в console)
│   ├── migrations/
│   │   ├── 20260519000000-create-all-tables.js
│   │   ├── ...                         # промежуточные миграции
│   │   ├── 20260709000001-payment-details-screenshot-source.js
│   │   └── 20260709000002-user-role-active.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── group.routes.js
│   │   ├── lesson.routes.js
│   │   ├── individualCourse.routes.js
│   │   ├── individualLesson.routes.js
│   │   ├── homework.routes.js
│   │   ├── attendance.routes.js
│   │   ├── payment.routes.js
│   │   ├── student.routes.js
│   │   ├── invitation.routes.js        # C3
│   │   ├── admin.routes.js
│   │   ├── analytics.routes.js
│   │   ├── dashboard.routes.js
│   │   └── post.routes.js              # ⏸️ запаркован
│   └── controllers/
│       ├── auth.controller.js
│       ├── user.controller.js
│       ├── group.controller.js
│       ├── lesson.controller.js
│       ├── individualCourse.controller.js
│       ├── individualLesson.controller.js
│       ├── homework.controller.js
│       ├── attendance.controller.js
│       ├── payment.controller.js
│       ├── student.controller.js
│       ├── invitation.controller.js
│       ├── admin.controller.js
│       ├── analytics.controller.js
│       └── dashboard.controller.js
├── seed-demo.js                        # демо-данные (--clean сбрасывает)
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── MODULES.md
│   ├── PROGRESS.md
│   └── ROLES.md
├── .env                                # UTF-8 без BOM (см. ниже)
├── .gitignore                          # node_modules/ + .env
└── package.json
```

---

## Поток запроса

```
HTTP Request
    │
    ▼
app.js  (cors, helmet, json, rate-limit)
    │
    ▼
routes/*.routes.js
    │
    ├── middleware/auth.js      ← JWT → req.user; проверяет active
    ├── middleware/role.js      ← isTeacher / isStudent / isAdmin
    ├── middleware/validate.js  ← Zod safeParse → 400 или req.body = result.data
    │
    ▼
controllers/*.controller.js
    │
    ├── utils/ownership.js      ← предикат «владеет ли учитель этим уроком»
    ├── utils/debtHelpers.js    ← расчёт долга (charged − paid)
    ├── models/index.js         ← Sequelize модели + ассоциации
    │       │
    │       ▼
    │   PostgreSQL (DB_URL)
    │
    ▼
res.json({ data }) / res.json({ error })
```

---

## Модели и связи (актуально 2026-07-09)

```
User ─────────────────── Group                   (teacher 1→many)
                                │
                                ├─── GroupStudent ─── Student     (many↔many через pivot)
                                └─── Lesson                       (1→many)

User ────────────────── IndividualCourse          (teacher 1→many)
Student ─────────────── IndividualCourse          (student → Student)
IndividualCourse ─────── IndividualLesson         (1→many, FK nullable)

Student ─────────────── IndividualLesson          (student → Student)
User ────────────────── IndividualLesson          (teacher → User)

Lesson ─────────────── Homework                  (nullable FK)
IndividualLesson ────── Homework                  (nullable FK)
Homework ────────────── HomeworkSubmission        (1→many)
Student ─────────────── HomeworkSubmission        (student → Student)

Lesson ─────────────── Attendance                (nullable FK)
IndividualLesson ────── Attendance               (nullable FK)
Student ─────────────── Attendance               (student → Student)

Student ─────────────── PaymentRecord            (student → Student)
User ────────────────── PaymentRecord            (teacher → User)

User ────────────────── Invitation               (teacher → User, inviteeUserId → User)
Group ───────────────── Invitation               (groupId → Group)
```

**Ключевая модель Student:** запись `{teacherId, userId (nullable), name}`. Все FK в таблицах → `Student.id`. `userId=null` → заглушка (без аккаунта), заполнен → реальный пользователь.

---

## Переменные окружения (.env)

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

JWT_SECRET=<64+ символов>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<64+ символов, отдельный от JWT_SECRET>

DB_URL=postgresql://user:pass@host:PORT/db

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev

GROQ_API_KEY=gsk_...

ADMIN_EMAIL=                   # bootstrap первого admin при старте

SENTRY_DSN=                    # опционально; off без DSN
```

> `TEACHER_SECRET` удалён — регистрация учителей открытая.

---

## Запуск

```bash
npm run dev     # nodemon index.js
npm start       # node index.js
npm test        # vitest (отдельная тест-БД TEST_DATABASE_URL)
npm run db:migrate          # применить миграции
npm run db:migrate:undo     # откатить последнюю миграцию
```

При старте `index.js`:
1. `require('./instrument')` — Sentry init
2. `require('dotenv').config()`
3. `sequelize.authenticate()` — проверяет соединение
4. `development`: `sync({ alter: true })`; `production`: только authenticate (схема через migrate)
5. `bootstrapAdmin()` — если `ADMIN_EMAIL` задан, повышает пользователя до admin
6. `app.listen(PORT)`

---

## Cloudinary

Фронтенд загружает файл на Cloudinary и получает URL. Бэкенд принимает готовый `fileUrl`.

Используется в: `HomeworkSubmission.fileUrl`, `Lesson/IndividualLesson.materials[].url`, `User.avatar/coverImage`, `PaymentRecord.screenshotUrl`.
