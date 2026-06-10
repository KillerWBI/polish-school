# Двойное подтверждение посещаемости (Dual Attendance Confirmation)

**Дата:** 2026-06-10
**Что это:** система честного учёта посещаемости, где **и учитель, и студент** подтверждают факт присутствия на уроке. Деньги начисляются только когда обе стороны согласны.

---

## Зачем это нужно (бизнес-смысл)

Раньше учитель ставил посещаемость один — и она сразу считалась за деньги. Проблемы:
- Учитель мог отметить присутствие там, где студента не было → лишние начисления.
- Студент мог заявить, что его не было, чтобы не платить → спор без следов.

Теперь:
1. Учитель отмечает посещаемость → запись уходит в статус **«ждёт студента»**, деньги пока **не** считаются.
2. Студенту приходит запрос: «Был / Не был».
3. **Ответы совпали** → `confirmed`, посещение засчитано (идёт в оплату).
4. **Ответы разошлись** → `disputed` (спор), посещение **не** засчитано до разрешения.
5. **Студент молчит 3 дня** → авто-подтверждение по версии учителя (но студент ещё может оспорить позже).
6. Учитель **разрешает спор**: принять версию студента или настоять на своей.

---

## Машина состояний (status)

```
                    учитель отметил
                          │
                          ▼
                  ┌───────────────┐
                  │ pending_student│  present = NULL (деньги НЕ считаются)
                  └───────┬───────┘
            ┌─────────────┼──────────────┬───────────────────┐
   студент: "был"=    студент: "был"≠   прошло 3 дня          │
   учитель            учитель           без ответа            │
            │             │                  │                │
            ▼             ▼                  ▼                │
      ┌──────────┐  ┌──────────┐      ┌──────────┐           │
      │confirmed │  │ disputed │      │confirmed │           │
      │present=  │  │present=  │      │present=  │           │
      │teacherM. │  │  false   │      │teacherM. │           │
      └──────────┘  └────┬─────┘      └──────────┘           │
                         │  учитель разрешает спор            │
                         │  accept=true  → версия студента    │
                         │  accept=false → версия учителя     │
                         └──────────────► confirmed ──────────┘
```

**Три статуса** (ENUM `status`):
| Статус | Значение `present` | Деньги | Описание |
|--------|-------------------|--------|----------|
| `pending_student` | `NULL` | ❌ нет | Учитель отметил, ждём ответа студента |
| `confirmed` | `true`/`false` | ✅ да (если `true`) | Обе стороны согласны (или авто-confirm) |
| `disputed` | `false` | ❌ нет | Ответы разошлись, ждём разрешения учителем |

---

## Изменённые и созданные файлы

### Бэкенд (`polish-school/`)

| Файл | Тип | Что сделано |
|------|-----|-------------|
| [src/migrations/20260609000001-add-attendance-confirmation.js](../src/migrations/20260609000001-add-attendance-confirmation.js) | 🆕 создан | Миграция БД: новые поля + backfill |
| [src/models/Attendance.js](../src/models/Attendance.js) | ✏️ изменён | Новые поля модели Sequelize |
| [src/controllers/attendance.controller.js](../src/controllers/attendance.controller.js) | ✏️ переписан | Вся логика подтверждения |
| [src/routes/attendance.routes.js](../src/routes/attendance.routes.js) | ✏️ изменён | Новые маршруты |

### Фронтенд (`polish-school-client/`)

| Файл | Тип | Что сделано |
|------|-----|-------------|
| [src/api/attendance.api.js](../../polish-school-client/src/api/attendance.api.js) | ✏️ изменён | Новые API-функции |
| [src/pages/attendance/AttendancePage.jsx](../../polish-school-client/src/pages/attendance/AttendancePage.jsx) | ✏️ переписан | 3-таба UI |

---

## 1. Миграция БД — `20260609000001-add-attendance-confirmation.js` 🆕

**Где:** `src/migrations/`
**Что даёт:** добавляет в таблицу `Attendances` поля для двойного подтверждения и безопасно переносит старые данные.

```js
async up(queryInterface) {
  // 1. present теперь nullable — pending-записи лежат как NULL, пока студент не ответил
  await queryInterface.changeColumn('Attendances', 'present', {
    type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null,
  });

  // 2. teacherMarked — что отметил УЧИТЕЛЬ
  await queryInterface.addColumn('Attendances', 'teacherMarked', { ... });
  // studentMarked — что подтвердил СТУДЕНТ
  await queryInterface.addColumn('Attendances', 'studentMarked', { ... });
  // status — текущее состояние записи (см. машину состояний)
  await queryInterface.addColumn('Attendances', 'status', {
    type: DataTypes.ENUM('pending_student', 'confirmed', 'disputed'),
    allowNull: false, defaultValue: 'confirmed',
  });

  // 3. Backfill: старые записи уже «согласованы» → teacherMarked=studentMarked=present
  await queryInterface.sequelize.query(`
    UPDATE "Attendances" SET "teacherMarked"="present", "studentMarked"="present"
    WHERE "teacherMarked" IS NULL
  `);
}
```

**Почему `defaultValue: 'confirmed'`:** чтобы старые записи (созданные до фичи) автоматически считались подтверждёнными — иначе вся прошлая статистика «обнулилась» бы.

**`down()`** — откат: зануляет NULL-present в `false`, удаляет 3 колонки и **дропает ENUM-тип** (`DROP TYPE "enum_Attendances_status"` — Postgres не удаляет ENUM сам при удалении колонки).

> ⚠️ **Нужно запустить на сервере:** `npm run db:migrate`

---

## 2. Модель — `Attendance.js` ✏️

**Где:** `src/models/Attendance.js`
**Что даёт:** описывает новые поля для Sequelize (ORM), чтобы их можно было читать/писать в коде.

```js
// Итоговый результат: null = ожидает подтверждения, true = был, false = не был/спор
present:       { type: BOOLEAN, allowNull: true, defaultValue: null },
// Что отметил учитель
teacherMarked: { type: BOOLEAN, allowNull: true, defaultValue: null },
// Что подтвердил студент
studentMarked: { type: BOOLEAN, allowNull: true, defaultValue: null },
// Статус двойного подтверждения
status: {
  type: ENUM('pending_student', 'confirmed', 'disputed'),
  allowNull: false, defaultValue: 'confirmed',
},
```

Unique-индексы `(lessonId, studentId)` и `(individualLessonId, studentId)` **не менялись** — защищают от дублей при `bulkCreate`.

---

## 3. Контроллер — `attendance.controller.js` ✏️ (ядро логики)

**Где:** `src/controllers/attendance.controller.js`
Пять функций, каждая отвечает за свой шаг сценария.

### `autoConfirmExpired()` — авто-подтверждение через 3 дня
**Что даёт:** если студент не ответил 3 дня — засчитываем по версии учителя. Вызывается «лениво» в начале `getAll` и `getPending` (нет отдельного cron).

```js
const cutoff = new Date(Date.now() - 3*24*60*60*1000).toISOString().slice(0,10);
// Один SQL-UPDATE с JOIN на Lessons (и отдельно на IndividualLessons):
//   берём все pending_student записи, чей урок был раньше cutoff,
//   и проставляем studentMarked = teacherMarked, status = 'confirmed'
UPDATE "Attendances" a SET "studentMarked"="teacherMarked", "status"='confirmed', "present"="teacherMarked"
FROM "Lessons" l
WHERE a."lessonId"=l.id AND a."status"='pending_student' AND l."date" < :cutoff
```

**Почему raw SQL:** один запрос обновляет все просроченные записи разом (вместо цикла «найти → обновить» по каждой).

### `getAll(req, res)` — история посещаемости
**Что даёт:** список записей для текущего пользователя. Студент видит только свои (`studentId = req.user.id`). Поддерживает фильтры `?lessonId / ?individualLessonId / ?month / ?from / ?to / ?status`, пагинацию `?page&limit`. Сначала вызывает `autoConfirmExpired()`.

### `getPending(req, res)` — ожидающие действия
**Что даёт:** наполняет вкладки «Ожидают» и «Спорные».
- **Студент** → свои записи со статусом `pending_student` или `disputed`.
- **Учитель** → собирает все свои уроки (группы по `teacherId` + индивидуальные) и возвращает записи `pending_student`/`disputed` по ним, с именем студента (`include User as student`).

### `create(req, res)` — учитель отмечает посещаемость (bulk)
**Что даёт:** массово ставит отметки. Ключевое отличие от старой версии — запись создаётся **не сразу подтверждённой**:

```js
const rows = records.map(r => ({
  teacherMarked: r.present ?? false,  // что сказал учитель
  studentMarked: null,                // студент ещё не ответил
  present:       null,                // null = деньги НЕ считаются
  status:        'pending_student',
}));
// ownership-проверка: isHwOwner({lessonId, individualLessonId}, req.user.id) → 403 если чужой урок
// delete-then-insert в транзакции (перезапись отметок без дублей)
```

### `confirmStudent(req, res)` — студент подтверждает / оспаривает
**Что даёт:** студент жмёт «Был/Не был». Сравнение с отметкой учителя решает исход:

```js
if (record.studentId !== req.user.id) return 403;     // только своя запись
record.studentMarked = present;
if (present === record.teacherMarked) {                // совпало
  record.status = 'confirmed'; record.present = record.teacherMarked;
} else {                                               // разошлось
  record.status = 'disputed';  record.present = false; // не засчитано
}
```

### `teacherResolve(req, res)` — учитель разрешает спор
**Что даёт:** закрывает `disputed`-запись. `accept: true` → принять студента, `false` → настоять на своём. В обоих случаях → `confirmed`.

```js
if (!await isHwOwner(record, req.user.id)) return 403;  // только владелец урока
if (accept) { record.teacherMarked = record.studentMarked; record.present = record.studentMarked; }
else        { record.studentMarked = record.teacherMarked; record.present = record.teacherMarked; }
record.status = 'confirmed';
```

---

## 4. Маршруты — `attendance.routes.js` ✏️

**Где:** `src/routes/attendance.routes.js`
**Что даёт:** связывает URL с функциями контроллера и middleware прав.

```js
router.get('/pending', auth, ctrl.getPending);              // ⚠️ ДО /:id !
router.get('/',        auth,            ctrl.getAll);
router.post('/',       auth, isTeacher, ctrl.create);        // только учитель
router.post('/:id/confirm', auth, isStudent, ctrl.confirmStudent);  // только студент
router.put('/:id',     auth, isTeacher, ctrl.teacherResolve);       // только учитель
```

> ⚠️ **Важный нюанс Express:** `/pending` стоит **выше** `/:id`, иначе Express примет слово `pending` за значение параметра `:id`.

---

## 5. Фронтенд API — `attendance.api.js` ✏️

**Где:** `polish-school-client/src/api/attendance.api.js`
**Что даёт:** функции-обёртки над axios для вызова бэкенда из React.

```js
// Записи, ожидающие действия (pending + disputed) для текущего пользователя
getPendingAttendance()            → GET  /attendance/pending
// Студент подтверждает (true) или оспаривает (false)
confirmAttendance(id, present)    → POST /attendance/:id/confirm  { present }
// Учитель разрешает спор: accept=true → версия студента
resolveAttendanceDispute(id, accept) → PUT /attendance/:id        { accept }
// saveAttendance / getAttendance — без изменений (bulk-отметка + история)
```

---

## 6. Страница — `AttendancePage.jsx` ✏️

**Где:** `polish-school-client/src/pages/attendance/AttendancePage.jsx`
**Что даёт:** весь UI. Три верхние вкладки (`ModeBar`) с счётчиками:

| Вкладка | Учитель | Студент |
|---------|---------|---------|
| **Журнал / История** | `TeacherView` — выбор группы/урока + форма отметок + статусы подтверждений | `StudentView` — история только `confirmed`-записей + % посещаемости |
| **Ожидают (N)** | `PendingView` — список «ждём ответа студента» (только инфо) | `PendingView` — кнопки «Был / Не был» по каждому уроку |
| **Спорные (N)** | `DisputedView` — кнопки «Принять студента / Настоять на своём» | `DisputedView` — может изменить свой ответ |

Данные вкладок берутся из одного запроса `getPendingAttendance()` и фильтруются по `status` на клиенте:
```js
const pendingItems  = pending.filter(r => r.status === 'pending_student')
const disputedItems = pending.filter(r => r.status === 'disputed')
```
Константа `STATUS_BADGE` рисует цветные бейджи (зелёный/жёлтый/красный) для каждого статуса.

---

## Как проверить вручную (чек-лист)

1. **Запустить миграцию:** `npm run db:migrate` → в таблице `Attendances` появились `teacherMarked`, `studentMarked`, `status`.
2. **Учитель** отмечает посещаемость на уроке → запись создаётся со `status='pending_student'`, `present=null`. Деньги по ней пока не считаются.
3. **Студент** заходит → во вкладке «Подтвердить» висит счётчик (N). Жмёт «Был».
   - Если учитель тоже ставил «был» → запись → `confirmed`, появляется в истории.
   - Если учитель ставил «не был» → запись → `disputed`, попадает во вкладку «Спорные».
4. **Учитель** во вкладке «Спорные» жмёт «Принять студента» или «Настоять на своём» → `confirmed`.
5. **Авто-confirm:** если урок был >3 дней назад и студент молчал → при следующем открытии страницы запись сама станет `confirmed` по версии учителя.

---

## Что НЕ сделано (осознанно)

- **Email/push-уведомления** студенту о новом запросе — пока только in-app счётчик во вкладке (по согласованию). Email-напоминания — отдельный Sprint H.
- **Блокировка студента в группе** при систематическом отказе подтверждать — обсуждалось, но не реализовано (учитель решает споры вручную).
- **Cron для авто-confirm** — вместо него ленивая обработка при заходе на страницу (проще, без доп. инфраструктуры).
