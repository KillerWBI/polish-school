const { User } = require('../models');

// Поля, которые возвращаем в публичном профиле (без email, password, токенов)
const PUBLIC_PROFILE_FIELDS = [
  'id', 'name', 'username', 'role',
  'avatar', 'coverImage', 'bio',
  'socialTelegram', 'socialWhatsApp', 'socialLinkedIn',
  'languages', 'createdAt',
];

// Поля, которые пользователь может править в своём профиле
const EDITABLE_PROFILE_FIELDS = [
  'name', 'username', 'avatar', 'coverImage', 'bio',
  'socialTelegram', 'socialWhatsApp', 'socialLinkedIn', 'languages',
];

const USERNAME_RE = /^[a-z0-9_]{3,40}$/;

const getAll = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'email', 'role'],
      limit,
      offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
};

const getOne = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'role'],
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // студент может смотреть только себя
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
};

const update = async (req, res) => {
  try {
    // студент может изменять только себя
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name } = req.body;
    await user.update({ name });

    res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
};

// PUT /users/me/profile — обновление своего профиля (Instagram-style поля)
const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Берём только разрешённые поля из body
    const updates = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Username: формат + уникальность
    if (updates.username !== undefined) {
      updates.username = String(updates.username).toLowerCase().trim();
      if (!USERNAME_RE.test(updates.username)) {
        return res.status(400).json({ error: 'username: только латиница, цифры, _ (3-40 символов)' });
      }
      if (updates.username !== user.username) {
        const taken = await User.findOne({ where: { username: updates.username }, attributes: ['id'] });
        if (taken) return res.status(400).json({ error: 'Этот username уже занят' });
      }
    }

    // Bio: max 300 символов
    if (updates.bio !== undefined && updates.bio !== null && String(updates.bio).length > 300) {
      return res.status(400).json({ error: 'Bio не должно превышать 300 символов' });
    }

    // Languages: массив объектов { code, level? }
    if (updates.languages !== undefined) {
      if (!Array.isArray(updates.languages)) {
        return res.status(400).json({ error: 'languages должен быть массивом' });
      }
      for (const l of updates.languages) {
        if (!l || typeof l.code !== 'string' || !l.code.trim()) {
          return res.status(400).json({ error: 'Каждый язык должен иметь поле code' });
        }
      }
    }

    await user.update(updates);

    // Возвращаем обновлённый публичный профиль
    const fresh = await User.findByPk(user.id, { attributes: PUBLIC_PROFILE_FIELDS });
    res.json({ data: fresh });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Этот username уже занят' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors?.[0]?.message || 'Ошибка валидации' });
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

// GET /users/@:username/profile — публичный профиль (для всех авторизованных)
const getPublicProfile = async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const user = await User.findOne({
      where: { username },
      attributes: PUBLIC_PROFILE_FIELDS,
    });
    if (!user) return res.status(404).json({ error: 'Профиль не найден' });
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
};

module.exports = { getAll, getOne, update, updateProfile, getPublicProfile };
