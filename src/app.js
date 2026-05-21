const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Безопасные заголовки (CSP/HSTS/X-Frame и т.д.)
app.use(helmet());

// CORS — разрешаем только CLIENT_URL (в dev совпадает с localhost:5173)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
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

// Роуты
app.use('/api/v1/auth',               require('./routes/auth.routes'));
app.use('/api/v1/users',              require('./routes/user.routes'));
app.use('/api/v1/groups',             require('./routes/group.routes'));
app.use('/api/v1/lessons',            require('./routes/lesson.routes'));
app.use('/api/v1/individual-courses', require('./routes/individualCourse.routes'));
app.use('/api/v1/individual-lessons', require('./routes/individualLesson.routes'));
app.use('/api/v1/homework',           require('./routes/homework.routes'));
app.use('/api/v1/attendance',         require('./routes/attendance.routes'));
app.use('/api/v1/payments',           require('./routes/payment.routes'));

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
