const sequelize = require('../src/config/database');

// Подключение к тест-БД. Импортируется ТОЛЬКО тестами, которым нужна база
// (через helpers.js) — чистые unit-тесты благодаря этому идут без Postgres.
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL || '';
  if (!/polish_test/.test(url)) {
    throw new Error('TEST_DATABASE_URL должен указывать на базу *polish_test* (защита боевой БД)');
  }
  await sequelize.sync({ force: true }); // чистая схема под каждый файл
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
