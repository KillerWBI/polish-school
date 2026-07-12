require('dotenv').config();
const { Sequelize } = require('sequelize');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// В тестах подключаемся ТОЛЬКО к отдельной TEST_DATABASE_URL — боевая БД из тестов недоступна.
const dbUrl = isTest ? process.env.TEST_DATABASE_URL : process.env.DB_URL;

// Managed-Postgres (Neon/Railway/Supabase) требует SSL. Включаем его в production
// ИЛИ когда строка подключения явно указывает на такой хост (напр. локальный запуск против Neon).
// rejectUnauthorized:false — провайдеры отдают self-signed цепочку; шифрование канала при этом есть.
const needsSsl = isProd || /sslmode=require|neon\.tech|railway|supabase/.test(dbUrl || '');

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: isProd || isTest ? false : console.log,
  dialectOptions: needsSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

module.exports = sequelize;
