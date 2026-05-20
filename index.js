require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('БД подключена');

    // В разработке — автосинхронизация схемы (alter); в production — только миграции (npm run db:migrate)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('Модели синхронизированы (dev)');
    } else {
      console.log('Production: синхронизация через миграции (npm run db:migrate)');
    }

    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });
  } catch (err) {
    console.error('Ошибка запуска:', err);
    process.exit(1);
  }
}

start();
