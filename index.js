require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('БД подключена');

    // sync({ alter: true }) для разработки — обновляет таблицы без сброса данных
    await sequelize.sync({ alter: true });
    console.log('Модели синхронизированы');

    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });
  } catch (err) {
    console.error('Ошибка запуска:', err);
    process.exit(1);
  }
}

start();
