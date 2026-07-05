const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,                         // describe/it/expect без импортов
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,                // одна тест-БД → файлы последовательно
    env: { NODE_ENV: 'test' },             // database.js → TEST_DATABASE_URL
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
