const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendVerificationEmail } = require('../services/email');
const { validateEmail } = require('../services/emailValidator');
const { generateUsername } = require('../utils/username');

// Генерирует JWT для пользователя
const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// Генерирует токен подтверждения email (24ч TTL)
const generateVerificationToken = () => ({
  token:     crypto.randomBytes(32).toString('hex'),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});

// Базовая логика создания пользователя + отправки письма верификации
const createUserWithVerification = async ({ name, email, password, role }) => {
  const hash = await bcrypt.hash(password, 10);
  const { token, expiresAt } = generateVerificationToken();
  const username = await generateUsername(name);
  const user = await User.create({
    name,
    username,
    email,
    password: hash,
    role,
    emailVerified: false,
    emailVerificationToken: token,
    emailVerificationExpiresAt: expiresAt,
  });
  // Не блокируем регистрацию если письмо упало — логируем и продолжаем
  try {
    await sendVerificationEmail(email, name, token);
  } catch (err) {
    console.error('Не удалось отправить письмо верификации:', err);
  }
  return user;
};

const userResponse = (user) => ({
  id:            user.id,
  name:          user.name,
  username:      user.username,
  email:         user.email,
  role:          user.role,
  emailVerified: user.emailVerified,
  avatar:        user.avatar,
});

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

    const check = await validateEmail(email);
    if (!check.valid) return res.status(400).json({ error: check.reason });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const user  = await createUserWithVerification({ name, email, password, role: 'student' });
    const token = signToken(user);
    res.status(201).json({ data: { token, user: userResponse(user) } });
  } catch (err) {
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
    // Всегда вызываем bcrypt.compare — иначе «нет юзера» быстрее «неверный пароль»,
    // и можно угадать email-базу по времени ответа (timing attack).
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuvuXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = await bcrypt.compare(password, user ? user.password : dummyHash);
    if (!user || !valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signToken(user);
    res.json({ data: { token, user: userResponse(user) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'username', 'email', 'role', 'emailVerified', 'avatar'],
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
    const { name, password } = req.body;
    const email = req.body.email?.toLowerCase().trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    const check = await validateEmail(email);
    if (!check.valid) return res.status(400).json({ error: check.reason });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const user  = await createUserWithVerification({ name, email, password, role: 'teacher' });
    const token = signToken(user);
    res.status(201).json({ data: { token, user: userResponse(user) } });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка регистрации учителя' });
  }
};

// Подтверждение email по токену из письма
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Токен обязателен' });

    const user = await User.findOne({ where: { emailVerificationToken: token } });
    if (!user) return res.status(400).json({ error: 'Неверный или устаревший токен' });

    if (user.emailVerified) {
      return res.json({ data: { message: 'Email уже подтверждён', alreadyVerified: true } });
    }

    if (user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Срок действия ссылки истёк. Запросите новое письмо.' });
    }

    await user.update({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    });

    res.json({ data: { message: 'Email подтверждён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка подтверждения email' });
  }
};

// Повторная отправка письма (требует auth)
const resendVerification = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.emailVerified) return res.status(400).json({ error: 'Email уже подтверждён' });

    const { token, expiresAt } = generateVerificationToken();
    await user.update({
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });

    await sendVerificationEmail(user.email, user.name, token);
    res.json({ data: { message: 'Письмо отправлено' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки письма' });
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

module.exports = {
  register, registerTeacher, login, me,
  verifyEmail, resendVerification, changePassword,
};
