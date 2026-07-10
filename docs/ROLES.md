# Роли пользователей

**Обновлено 2026-07-09.** Добавлена роль `admin`. `teacherSecret` удалён (открытая регистрация). «Ученик» в данных — запись `Student` (заглушка/реальный), модель — REVISION.md §2.1/§5.

## Роли в системе

| Роль | Значение | Создаётся |
|------|----------|-----------|
| `teacher` | Учитель — workspace: группы, уроки, ДЗ, посещаемость, финансы | `POST /auth/register-teacher` (открытая, без секрета) |
| `student` | Студент — своё расписание, ДЗ, оценки, долг | `POST /auth/register` (открытая) |
| `admin` | Администратор — управление всей платформой | Первый: `ADMIN_EMAIL` в env → bootstrap при старте сервера. Следующие: через `/admin` → «Действия» → «Сменить роль» → Admin |

### Как работает admin
- `isAdmin` middleware — `role !== 'admin'` → 403; монтируется на `/api/v1/admin/*`
- `isTeacher` пропускает admins (admin может смотреть teacher-только эндпоинты)
- `auth.js` проверяет `user.active` в БД на каждый запрос → деактивация мгновенная
- Нельзя деактивировать другого admin; нельзя понизить самого себя из admin
- AdminPage.jsx доступна только `role=admin` через `RoleRoute`

---

## Что может teacher

### Auth / Profile
- Регистрация (`register-teacher`, открытая, без секрета), логин
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
| GET /payments/debts | ✅ (свои ученики) | ❌ |
| GET /payments/debt | ❌ | ✅ (свои учителя) |
| POST /payments/record | ✅ | ❌ |
| GET /payments/history | ✅ | ❌ |
| GET /admin/stats | ❌ | ❌ | только admin |
| GET /admin/users | ❌ | ❌ | только admin |
| GET /admin/teachers | ❌ | ❌ | только admin |
| PATCH /admin/users/:id/role | ❌ | ❌ | только admin |
| PATCH /admin/users/:id/plan | ❌ | ❌ | только admin |
| PATCH /admin/users/:id/deactivate | ❌ | ❌ | только admin |
| PATCH /admin/users/:id/activate | ❌ | ❌ | только admin |

---

## Как создать первого admin

1. Зарегистрировать обычный аккаунт (учитель или студент)
2. Задать `ADMIN_EMAIL=email@example.com` в `.env` Railway/локально
3. Перезапустить сервер — bootstrap автоматически повысит этого пользователя до admin
4. Войти в аккаунт — в сайдбаре появится «Администрирование» → `/admin`

Следующих adminов создавать через `/admin` → «Пользователи» → «Действия» → «Сменить роль» → Admin.

## Как создать учителя

Открытая регистрация без секрета через `POST /auth/register-teacher`:

```json
{
  "name": "Имя Учителя",
  "email": "teacher@school.com",
  "password": "пароль"
}
```

Возвращает `{ data: { token, user } }` — токен сразу готов к использованию. `TEACHER_SECRET` удалён.
