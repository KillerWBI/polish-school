/**
 * Одноразовый скрипт: помечает уже применённые миграции как выполненные.
 *
 * Когда нужен: если БД создавалась через `sync({alter:true})` (dev-режим),
 * таблицы уже существуют, но SequelizeMeta пуста — sequelize-cli попытается
 * заново прогнать создание таблиц и упадёт.
 *
 * Запуск: node scripts/mark-existing-migrations.js
 * После: npm run db:migrate (прогонит только новые миграции)
 */
require('dotenv').config();
const sequelize = require('../src/config/database');

const APPLIED_MIGRATIONS = [
  '20260519000000-create-all-tables.js',
  '20260521000001-add-unique-constraints.js',
  '20260521000002-add-email-verification.js',
];

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ БД подключена');

    // Создаём SequelizeMeta если её нет
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL UNIQUE, PRIMARY KEY ("name"))'
    );

    for (const name of APPLIED_MIGRATIONS) {
      await sequelize.query(
        'INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT (name) DO NOTHING',
        { replacements: { name } }
      );
      console.log(`✓ Помечена как применённая: ${name}`);
    }

    console.log('\nГотово. Запусти: npm run db:migrate');
    process.exit(0);
  } catch (err) {
    console.error('Ошибка:', err);
    process.exit(1);
  }
})();
