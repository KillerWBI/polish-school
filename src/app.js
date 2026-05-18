const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Роуты
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/groups', require('./routes/group.routes'));
app.use('/api/v1/lessons', require('./routes/lesson.routes'));
app.use('/api/v1/individual-lessons', require('./routes/individualLesson.routes'));
app.use('/api/v1/homework', require('./routes/homework.routes'));
app.use('/api/v1/attendance', require('./routes/attendance.routes'));
app.use('/api/v1/payments', require('./routes/payment.routes'));

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;
