# Роли пользователей

## Роли в системе

| Роль | Значение | Создаётся |
|------|----------|-----------|
| `teacher` | Учитель — полный доступ | Вручную в БД (или через seed) |
| `student` | Студент | Через `POST /auth/register` |

> На текущем этапе регистрация создаёт только `student`.  
> Учитель создаётся вручную (через прямой INSERT или seed-скрипт).

---

## Что может teacher

### Auth / Profile
- Логин, просмотр и редактирование своего профиля

### Users
- Видит список всех студентов
- Редактирует любой профиль

### Groups
- Создаёт, редактирует, удаляет группы
- Добавляет / убирает студентов из групп

### Lessons
- Создаёт, редактирует, удаляет уроки любой своей группы
- Добавляет материалы к урокам (ссылки, файлы, текст)

### Individual Lessons
- Создаёт, редактирует, удаляет индивидуальные уроки с любым студентом

### Homework
- Создаёт, редактирует, удаляет задания
- Просматривает все сдачи
- Выставляет оценки

### Attendance
- Выставляет посещаемость (bulk) для любого урока
- Исправляет записи

### Payments
- Запускает расчёт оплаты за месяц
- Отмечает оплату как выполненную

---

## Что может student

### Auth / Profile
- Регистрация, логин
- Просмотр и редактирование только своего профиля

### Groups
- Видит только группы, в которых состоит
- Видит список студентов группы (через `GET /groups/:id`)

### Lessons
- Видит уроки только своих групп (тема, дата, время, материалы, ссылка)

### Individual Lessons
- Видит только свои индивидуальные уроки

### Homework
- Видит задания (нужна доработка фильтрации — сейчас видит все)
- Сдаёт ДЗ: загружает файл на Cloudinary на фронте, передаёт URL + комментарий
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
| POST /auth/login | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ |
| GET /users | ✅ | ❌ |
| GET /users/:id | ✅ | только себя |
| PUT /users/:id | ✅ | только себя |
| GET /groups | ✅ все | ✅ свои |
| POST /groups | ✅ | ❌ |
| GET /groups/:id | ✅ | ✅ если член |
| PUT/DELETE /groups/:id | ✅ | ❌ |
| POST /groups/:id/students | ✅ | ❌ |
| DELETE /groups/:id/students/:id | ✅ | ❌ |
| GET /lessons | ✅ все | ✅ своих групп |
| POST/PUT/DELETE /lessons | ✅ | ❌ |
| GET /lessons/:id | ✅ | ✅ если член группы |
| GET /individual-lessons | ✅ все | ✅ свои |
| POST/PUT/DELETE /individual-lessons | ✅ | ❌ |
| GET /individual-lessons/:id | ✅ | ✅ если свой |
| GET /homework | ✅ все | 🔶 все (нужна доработка) |
| POST/PUT/DELETE /homework | ✅ | ❌ |
| POST /homework/:id/submit | ❌ | ✅ |
| GET /homework/:id/submissions | ✅ | ❌ |
| PUT /homework/:id/submissions/:subId | ✅ | ❌ |
| GET /attendance | ✅ все | ✅ свою |
| POST /attendance | ✅ | ❌ |
| PUT /attendance/:id | ✅ | ❌ |
| GET /payments | ✅ все | ✅ свои |
| POST /payments/calculate | ✅ | ❌ |
| PUT /payments/:id | ✅ | ❌ |

---

## Как создать учителя

На текущем этапе — вручную в PostgreSQL:

```sql
INSERT INTO "Users" (id, name, email, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Имя Учителя',
  'teacher@school.com',
  -- bcrypt hash пароля (rounds=10)
  '$2b$10$...',
  'teacher',
  NOW(),
  NOW()
);
```

Или через seed-скрипт (добавить в план):
```js
// scripts/seed-teacher.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');

async function seed() {
  const hash = await bcrypt.hash('пароль_учителя', 10);
  await User.create({ name: 'Учитель', email: 'teacher@school.com', password: hash, role: 'teacher' });
  console.log('Учитель создан');
  process.exit(0);
}
seed();
```
