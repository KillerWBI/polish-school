const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,                         // describe/it/expect без импортов
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,                // одна тест-БД → файлы последовательно
    env: { NODE_ENV: 'test', RESEND_API_KEY: '' }, // БД → TEST_DATABASE_URL; письма — dev-режим (без сети)
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
