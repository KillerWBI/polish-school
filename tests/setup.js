// Общий guard для всех тестов. Работа с БД — в tests/db.js (только для тестов,
// которым база реально нужна), чтобы unit-тесты не требовали Postgres.
beforeAll(() => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Тесты требуют NODE_ENV=test');
  }
});
