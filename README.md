# Peravenor — бэкенд

API платформы [peravenor.com](https://peravenor.com): рабочее место преподавателя и кабинет
ученика по любому предмету — группы, уроки, домашние задания, посещаемость и финансы.
Ученик может учиться и без преподавателя: свои темы, адаптивные AI-тесты, словарь, заметки.

Фронтенд — в репозитории [polish-school-client](https://github.com/KillerWBI/polish-school-client).

## Стек

Node.js 22 · Express 5 · Sequelize 6 · PostgreSQL (Neon) · JWT · Zod · Vitest
Хостинг — Railway.

## Запуск

```bash
npm install
cp .env.example .env      # заполнить значения
npm run db:migrate
npm run dev
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Разработка с автоперезапуском |
| `npm start` | Продакшен |
| `npm test` | Vitest. Тесты с БД требуют `TEST_DATABASE_URL` |
| `npm run db:migrate` | Прогнать миграции |
| `npm run db:migrate:undo` | Откатить последнюю |
| `npm run test:db:up` / `:down` | Локальный тест-Postgres в Docker |

⚠️ `TEST_DATABASE_URL` обязан содержать `polish_test` — защита от прогона тестов
по продакшен-базе.

## Архитектура

Изоляция по `teacherId`: преподаватель видит только свой workspace. Ученик — единая
запись `Student`, которая может быть без аккаунта (ведёт только преподаватель) или
связана с реальным пользователем.

Валидация — Zod-схемы в `src/schemas/` через `middleware/validate`. Авторизация
(«владеет ли этот преподаватель этой сущностью») — отдельный слой, схемами не заменяется.

## Документация

`docs/` — [API.md](docs/API.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md),
[MODULES.md](docs/MODULES.md), [PROGRESS.md](docs/PROGRESS.md), [ROLES.md](docs/ROLES.md).

## Ветки

`main` — продакшен (деплой автоматом при push), `dev` — работа.
Выкатка через PR `dev` → `main`.
