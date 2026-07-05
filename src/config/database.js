require('dotenv').config();
const { Sequelize } = require('sequelize');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// В тестах подключаемся ТОЛЬКО к отдельной TEST_DATABASE_URL — боевая БД из тестов недоступна.
const dbUrl = isTest ? process.env.TEST_DATABASE_URL : process.env.DB_URL;

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: isProd || isTest ? false : console.log,
  // В production требуем SSL (Railway/managed Postgres). rejectUnauthorized:false —
  // Railway отдаёт self-signed цепочку; шифрование канала при этом есть.
  dialectOptions: isProd ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

module.exports = sequelize;
