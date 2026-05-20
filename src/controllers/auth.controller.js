const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Генерирует JWT для пользователя
const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

const register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: 'student' });

    const token = signToken(user);
    res.status(201).json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    // Страховка: уникальный индекс на уровне БД тоже блокирует дубли
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
};

const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = req.body.email?.toLowerCase().trim();
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signToken(user);
    res.json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'role'],
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
};

const registerTeacher = async (req, res) => {
  try {
    const { name, password, teacherSecret } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!name || !email || !password || !teacherSecret) {
      return res.status(400).json({ error: 'Все поля обязательны (name, email, password, teacherSecret)' });
    }
    if (teacherSecret !== process.env.TEACHER_SECRET) {
      return res.status(403).json({ error: 'Неверный секрет' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash, role: 'teacher' });

    const token = signToken(user);
    res.status(201).json({ data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка регистрации учителя' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword и newPassword обязательны' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Текущий пароль неверен' });

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });

    res.json({ data: { message: 'Пароль изменён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
};

module.exports = { register, registerTeacher, login, me, changePassword };
