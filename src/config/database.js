require('dotenv').config();
const { Sequelize } = require('sequelize');

const isProd = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(process.env.DB_URL, {
  dialect: 'postgres',
  logging: isProd ? false : console.log,
  // В production требуем SSL (Railway/managed Postgres). rejectUnauthorized:false —
  // Railway отдаёт self-signed цепочку; шифрование канала при этом есть.
  dialectOptions: isProd ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

module.exports = sequelize;
