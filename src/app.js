const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Безопасные заголовки (CSP/HSTS/X-Frame и т.д.)
app.use(helmet());

// CORS — в production строго по CLIENT_URL, в dev принимаем любой localhost:*
// (Vite автоматически переходит на 5174/5175/... если 5173 занят).
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: (origin, cb) => {
    // Запросы без origin (Postman, curl, server-to-server) — разрешаем
    if (!origin) return cb(null, true);
    if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    if (origin === process.env.CLIENT_URL) return cb(null, true);
    cb(new Error('Не разрешено CORS-политикой'));
  },
  credentials: true,
}));

// Ограничиваем размер JSON-payload (materials/lessonLink — обычно мелкие)
app.use(express.json({ limit: '256kb' }));

// Брут-форс на логин (20 попыток / 15 мин)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
});
app.use('/api/v1/auth/login', loginLimiter);

// Защита от массовой регистрации (5 / 15 мин на IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток регистрации. Попробуйте позже.' },
});
app.use('/api/v1/auth/register',         registerLimiter);
app.use('/api/v1/auth/register-teacher', registerLimiter);

// Защита от брутфорса токенов верификации (10 попыток / 15 мин на IP)
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
});
app.use('/api/v1/auth/verify-email',       verifyLimiter);
app.use('/api/v1/auth/resend-verification', verifyLimiter);

// Мониторинг / health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Роуты
app.use('/api/v1/dashboard',          require('./routes/dashboard.routes'));
app.use('/api/v1/analytics',          require('./routes/analytics.routes'));
app.use('/api/v1/auth',               require('./routes/auth.routes'));
app.use('/api/v1/users',              require('./routes/user.routes'));
app.use('/api/v1/groups',             require('./routes/group.routes'));
app.use('/api/v1/lessons',            require('./routes/lesson.routes'));
app.use('/api/v1/individual-courses', require('./routes/individualCourse.routes'));
app.use('/api/v1/individual-lessons', require('./routes/individualLesson.routes'));
app.use('/api/v1/homework',           require('./routes/homework.routes'));
app.use('/api/v1/attendance',         require('./routes/attendance.routes'));
app.use('/api/v1/payments',           require('./routes/payment.routes'));
app.use('/api/v1/lesson-requests',    require('./routes/lessonRequest.routes'));

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
