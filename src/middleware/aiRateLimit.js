const rateLimit = require('express-rate-limit');

// Анти-всплеск для эндпоинтов, которые реально дёргают AI-провайдера (это стоит денег).
// Дневную квоту на пользователя считает utils/aiLimit.enforceAi — здесь ограничиваем ТЕМП.
// Вешается точечно на конкретные роуты: обычные операции (повторение карточек,
// сохранение результата теста, добавление слова) под лимит попадать не должны.
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // в dev мешает итерации
  message: { error: 'Слишком много ИИ-запросов подряд. Подождите минуту.' },
});

module.exports = { aiRateLimit };
