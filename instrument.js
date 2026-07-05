// Мониторинг ошибок (Sentry). Подключается ПЕРВОЙ строкой в index.js — до остального кода.
// Если SENTRY_DSN не задан — Sentry выключен (dev/тесты ничего не отправляют).
require('dotenv').config();
const Sentry = require('@sentry/node');

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,        // 10% трейсов — достаточно, не шумно
    sendDefaultPii: false,        // не слать IP/cookies по умолчанию
    // Подчищаем чувствительное перед отправкой
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  // Все контроллеры уже делают console.error(err). Перехватываем один раз здесь —
  // Error-объекты уезжают в Sentry, не трогая сами контроллеры.
  const origConsoleError = console.error;
  console.error = (...args) => {
    const err = args.find((a) => a instanceof Error);
    if (err) Sentry.captureException(err);
    origConsoleError(...args);
  };

  console.log('🛰️  Sentry подключён (' + (process.env.NODE_ENV || 'development') + ')');
}

module.exports = Sentry;
