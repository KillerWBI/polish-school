require('dotenv').config();

// Managed-Postgres (Neon/Railway/Supabase) требует SSL. Включаем его,
// если строка подключения указывает на такой хост — чтобы миграции
// проходили и локально (dev), и на сервере (prod).
const url = process.env.DB_URL || '';
const needsSsl = /sslmode=require/.test(url) || /neon\.tech/.test(url) || /railway/.test(url) || /supabase/.test(url);
const sslOptions = needsSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {};

module.exports = {
  development: {
    url: process.env.DB_URL,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: sslOptions,
  },
  production: {
    url: process.env.DB_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
};
