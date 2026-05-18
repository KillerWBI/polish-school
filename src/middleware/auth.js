const jwt = require('jsonwebtoken');

// Проверяет JWT из заголовка Authorization: Bearer <token>
// Добавляет req.user = { id, role }
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Токен недействителен' });
  }
};

module.exports = auth;
