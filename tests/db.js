const sequelize = require('../src/config/database');

// Подключение к тест-БД. Импортируется ТОЛЬКО тестами, которым нужна база
// (через helpers.js) — чистые unit-тесты благодаря этому идут без Postgres.
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL || '';
  if (!/polish_test/.test(url)) {
    throw new Error('TEST_DATABASE_URL должен указывать на базу *polish_test* (защита боевой БД)');
  }
  try {
    await sequelize.sync({ force: true }); // чистая схема под каждый файл
  } catch (e) {
    // Иначе на месте причины видно только «password authentication failed» —
    // и непонятно, что база вообще не поднята.
    throw new Error(
      `Не удалось подключиться к тест-базе (${url.replace(/:[^:@/]*@/, ':***@')}).\n` +
      `Причина: ${e.message}\n` +
      'Подними локальный Postgres: npm run test:db:up (нужен Docker), затем npm test.\n' +
      'В CI база поднимается сама (см. .github/workflows/ci.yml).'
    );
  }
});

afterAll(async () => {
  await sequelize.close();
});

module.exports = { sequelize };
