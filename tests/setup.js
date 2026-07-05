const sequelize = require('../src/config/database');

// Защита: тесты выполняются ТОЛЬКО на выделенной тест-БД (polish_test).
// Если что-то настроено не так — падаем ДО того, как тронем данные.
beforeAll(async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Тесты требуют NODE_ENV=test');
  }
  const url = process.env.TEST_DATABASE_URL || '';
  if (!/polish_test/.test(url)) {
    throw new Error('TEST_DATABASE_URL должен указывать на базу *polish_test* (защита боевой БД)');
  }
  await sequelize.sync({ force: true }); // чистая схема под каждый файл
});

afterAll(async () => {
  await sequelize.close();
});
