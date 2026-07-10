const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Мягкая авторизация: если токен есть и валиден — ставит req.user, иначе просто идёт дальше.
// Для публичных эндпоинтов, которые хотят знать пользователя, но не требуют входа
// (напр. форма поддержки: гость может писать, но залогиненному привяжем userId).
const optionalAuth = async (req, res, next) => {
  const cookieToken = req.cookies?.access_token;
  const header = req.headers.authorization;
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.id, { attributes: ['id', 'role', 'active'] });
    if (user && user.active) req.user = { id: user.id, role: user.role };
  } catch {
    // невалидный/просроченный токен — не ошибка для публичного эндпоинта, просто гость
  }
  next();
};

module.exports = optionalAuth;
