const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// CORS — разрешаем только CLIENT_URL (в dev совпадает с localhost:5173)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Rate limiting на login — защита от брут-форса (20 попыток / 15 мин)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
});
app.use('/api/v1/auth/login', loginLimiter);

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
