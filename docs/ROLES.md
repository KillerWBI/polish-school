# Роли пользователей

**Обновлено 2026-10-18.** Админ — один, по `ADMIN_EMAIL`; работает в кабинете учителя или ученика (режим `X-Act-As`) без лимитов тарифа; тарифы выдаются и ученикам. **2026-07-09:** добавлена роль `admin`. `teacherSecret` удалён (открытая регистрация). «Ученик» в данных — запись `Student` (заглушка/реальный), модель — REVISION.md §2.1/§5.

## Роли в системе

| Роль | Значение | Создаётся |
|------|----------|-----------|
| `teacher` | Учитель — workspace: группы, уроки, ДЗ, посещаемость, финансы | `POST /auth/register-teacher` (открытая, без секрета) |
| `student` | Студент — своё расписание, ДЗ, оценки, долг | `POST /auth/register` (открытая) |
| `admin` | Администратор — управление платформой + все функции учителя и ученика (для тестирования), без лимитов | `ADMIN_EMAIL` в env → bootstrap при старте сервера. Админ ровно один: у остальных админов роль при старте снимается |

### Как работает admin
- **Режим (2026-10-18).** В БД роль остаётся `admin`, но `auth.js` ставит `req.user = { id, role: 'teacher'|'student', isAdmin: true }` — роль берётся из заголовка `X-Act-As` (по умолчанию `teacher`). Так все контроллеры работают с админом как с учителем или учеником, без отдельных веток. У не-админов заголовок игнорируется
- Фронт: переключатель «Режим администратора» в меню профиля (`utils/actAs.js`, режим в `localStorage`, смена — с перезагрузкой, чтобы не осталось кэша прежнего кабинета). `AuthProvider` подменяет `user.role` на режим и добавляет `user.isAdmin`
- `isAdmin` middleware — `!req.user.isAdmin` → 403; монтируется на `/api/v1/admin/*` (доступна в любом режиме)
- `isTeacher` / `isStudent` — по текущему режиму
- **Без лимитов:** `planOf(req, me)` (`config/planLimits.js`) даёт админу тариф `unlimited` (только в коде, в БД его нет), ИИ-лимит — по роли из БД в `utils/aiLimit.js`
- Чтобы проверить кабинет ученика целиком, админ в режиме учителя находит себя поиском по нику (админу в поиске видны и админы), приглашает в свою группу и принимает приглашение в режиме ученика. Приглашение/курс/аналитика принимают `admin` наравне с `student`/`teacher`
- **Один админ:** при старте `bootstrapAdmin` (`index.js`) снимает `admin` со всех, чей email ≠ `ADMIN_EMAIL` (они становятся `teacher`), и повышает пользователя из `ADMIN_EMAIL`. Сменили почту на Railway → редеплой → прежний админ теряет админку. Выдача `admin` через «Сменить роль» в `/admin` живёт только до следующего перезапуска
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
3. Перезапустить сервер — bootstrap повысит этого пользователя до admin и снимет админку с прежних
4. Перелогиниться — в сайдбаре появится «Администрирование» → `/admin`, в меню профиля — «Режим администратора»

Если аккаунта с `ADMIN_EMAIL` ещё нет — зарегистрировать его и перезапустить сервер ещё раз (bootstrap работает только при старте).

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
