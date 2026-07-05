const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
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

// Парсинг cookie (refresh-токен лежит в httpOnly-cookie)
app.use(cookieParser());

// Лимитеры — только в production. В dev мешают итерации (hot-reload + дашборд
// легко выбирают 300/15мин, после чего 429 прилетает и на /auth/login).
const skipInDev = () => process.env.NODE_ENV !== 'production';

// Брут-форс на логин (20 попыток / 15 мин)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
});
app.use('/api/v1/auth/login', loginLimiter);

// Защита от массовой регистрации (5 / 15 мин на IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
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
  skip: skipInDev,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' },
});
app.use('/api/v1/auth/verify-email',       verifyLimiter);
app.use('/api/v1/auth/resend-verification', verifyLimiter);
app.use('/api/v1/auth/forgot-password',    verifyLimiter); // защита от спама письмами сброса
app.use('/api/v1/auth/reset-password',     verifyLimiter); // защита от перебора токена

// Мониторинг / health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Общий лимитер на весь API (защита от абуза/DoS сверх точечных auth-лимитов).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // SPA делает много запросов на страницу; 300 упирался у активного пользователя
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
  message: { error: 'Слишком много запросов. Попробуйте позже.' },
});
app.use('/api/v1', apiLimiter);

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
app.use('/api/v1/invitations',        require('./routes/invitation.routes'));
app.use('/api/v1/students',           require('./routes/student.routes'));

// ⏸️ Соц-слой/маркетплейс запаркован (разворот teacher-first, REVISION.md) —
// роуты РАЗМОНТИРОВАНЫ (код в репо оставлен, но недоступен снаружи).
// Вернуть при выделении отдельного соц-сервиса.
// app.use('/api/v1/lesson-requests', require('./routes/lessonRequest.routes'));
// app.use('/api/v1/teachers',        require('./routes/teacher.routes'));
// app.use('/api/v1/posts',           require('./routes/post.routes'));
// app.use('/api/v1/feed',            require('./routes/feed.routes'));

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
