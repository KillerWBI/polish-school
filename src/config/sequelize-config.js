require('dotenv').config();

module.exports = {
  development: {
    url: process.env.DB_URL,
    dialect: 'postgres',
    logging: console.log,
  },
  production: {
    url: process.env.DB_URL,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { rejectUnauthorized: false },
    },
  },
};
