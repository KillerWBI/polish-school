const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Проверяет JWT и убеждается, что аккаунт не деактивирован администратором.
// Добавляет req.user = { id, role }
const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Токен недействителен' });
  }

  // Проверяем active в БД — деактивация вступает в силу немедленно
  try {
    const user = await User.findByPk(payload.id, { attributes: ['id', 'role', 'active'] });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Аккаунт деактивирован' });
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Ошибка проверки аккаунта' });
  }
};

module.exports = auth;
