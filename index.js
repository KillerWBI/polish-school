require('./instrument'); // Sentry — до всего остального (если задан SENTRY_DSN)
require('dotenv').config();

// Валидация обязательных env-переменных до старта
const REQUIRED_ENV = ['JWT_SECRET', 'DB_URL'];
// В production дополнительно: отдельный секрет refresh-токена и CLIENT_URL (для CORS/refresh-cookie)
if (process.env.NODE_ENV === 'production') {
  REQUIRED_ENV.push('JWT_REFRESH_SECRET', 'CLIENT_URL');
}
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌ Отсутствуют обязательные env-переменные: ${missing.join(', ')}`);
  process.exit(1);
}

const app = require('./src/app');
const sequelize = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('БД подключена');

    // В разработке — автосинхронизация схемы (alter); в production — только миграции (npm run db:migrate)
    if (process.env.NODE_ENV !== 'production') {
      try {
        await sequelize.sync({ alter: true });
        console.log('Модели синхронизированы (dev)');
      } catch (syncErr) {
        // alter-синк иногда падает на пересоздании внешних ключей (напр. Lessons_groupId_fkey,
        // констрейнт уже под другим именем) — это косметика, схема ведётся миграциями.
        // Не роняем dev-сервер из-за этого.
        console.warn('⚠️  sync(alter) пропущен (не критично, схема — через миграции):', syncErr.message);
      }
    } else {
      console.log('Production: синхронизация через миграции (npm run db:migrate)');
    }

    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
    });

    // Ежедневные напоминания — в 08:00 UTC (= 10:00 по Варшаве летом).
    // Находит уроки и дедлайны ДЗ на завтра, шлёт email ученикам с верифицированными аккаунтами.
    const cron = require('node-cron');
    const { runReminders } = require('./src/services/reminderService');
    cron.schedule('0 8 * * *', () => {
      runReminders().catch(e => console.error('[reminders] ошибка:', e.message));
    }, { timezone: 'UTC' });
    console.log('Планировщик напоминаний запущен (08:00 UTC ежедневно)');
  } catch (err) {
    console.error('Ошибка запуска:', err);
    process.exit(1);
  }
}

start();
