const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { validateEmail } = require('../services/emailValidator');
const { generateUsername } = require('../utils/username');

// access-токен (короткоживущий, в теле ответа → localStorage/Bearer).
// Дефолт 1ч: при XSS-краже окно мало, refresh-cookie (30д) продлевает сессию.
// Без дефолта пустой JWT_EXPIRES_IN давал БЕССРОЧНЫЙ токен.
const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

// refresh-токен (30 дней, кладём в httpOnly-cookie; отдельный секрет, fallback на JWT_SECRET)
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
const signRefreshToken = (user) =>
  jwt.sign({ id: user.id, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '30d' });

const isProd = process.env.NODE_ENV === 'production';
const REFRESH_COOKIE = 'refreshToken';
const refreshCookieOpts = {
  httpOnly: true,                        // JS на фронте не видит → защита от XSS-кражи
  secure:   isProd,                      // по HTTPS только в проде (в dev http)
  sameSite: isProd ? 'none' : 'lax',     // 'none' для кросс-доменного прода (нужен secure)
  path:     '/api/v1/auth',              // cookie шлётся только на auth-эндпоинты
  maxAge:   30 * 24 * 60 * 60 * 1000,    // 30 дней
};

// Ставит refresh-cookie рядом с выдачей access — вызывается в login/register.
const setRefreshCookie = (res, user) => {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), refreshCookieOpts);
};

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
  plan:          user.plan,
  emailVerified: user.emailVerified,
  avatar:        user.avatar,
});

const register = async (req, res) => {
  try {
    // Формат/required/нормализация email — в schemas/auth.schema.js (validate в роуте)
    const { name, email, password } = req.body;

    const check = await validateEmail(email);
    if (!check.valid) return res.status(400).json({ error: check.reason });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const user  = await createUserWithVerification({ name, email, password, role: 'student' });
    const token = signToken(user);
    setRefreshCookie(res, user);
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
    const { email, password } = req.body; // нормализован схемой loginSchema

    const user = await User.findOne({ where: { email } });
    // Всегда вызываем bcrypt.compare — иначе «нет юзера» быстрее «неверный пароль»,
    // и можно угадать email-базу по времени ответа (timing attack).
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuvuXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const valid = await bcrypt.compare(password, user ? user.password : dummyHash);
    if (!user || !valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signToken(user);
    setRefreshCookie(res, user);
    res.json({ data: { token, user: userResponse(user) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
};

// POST /auth/refresh — читает refresh из httpOnly-cookie, выдаёт НОВЫЙ access.
// Access истёк → фронт дёргает refresh → если refresh валиден, отдаём свежий access
// (в теле, фронт кладёт в localStorage) + продлеваем refresh-cookie → фронт повторяет запрос.
const refresh = async (req, res) => {
  try {
    // 1) достаём refresh-токен из httpOnly-cookie
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) return res.status(401).json({ error: 'Нет refresh-токена' });

    // 2) проверяем его подпись/срок
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Refresh-токен недействителен' });
    }
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Неверный тип токена' });

    const user = await User.findByPk(payload.id, { attributes: ['id', 'role'] });
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    // 3) генерим НОВЫЙ access-токен (то же, что при login) — вернём его в теле
    const accessToken = signToken(user);
    // 4) продлеваем refresh-cookie (скользящее окно) — активный юзер не разлогинится через 30д
    setRefreshCookie(res, user);

    res.json({ data: { token: accessToken } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления токена' });
  }
};

// POST /auth/logout — гасит refresh-cookie (access протухнет сам).
const logout = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOpts, maxAge: undefined });
  res.json({ data: { message: 'Выход выполнен' } });
};

const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'username', 'email', 'role', 'plan', 'emailVerified', 'avatar'],
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
    // Формат/required/нормализация email — в schemas/auth.schema.js (validate в роуте)
    const { name, email, password } = req.body;

    const check = await validateEmail(email);
    if (!check.valid) return res.status(400).json({ error: check.reason });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Аккаунт с таким email уже существует' });
    }

    const user  = await createUserWithVerification({ name, email, password, role: 'teacher' });
    const token = signToken(user);
    setRefreshCookie(res, user);
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
    const { currentPassword, newPassword } = req.body; // required/min 6 — в changePasswordSchema

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

// Токен сброса пароля живёт 1 час (короче verify — чувствительнее)
const generateResetToken = () => ({
  token:     crypto.randomBytes(32).toString('hex'),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
});

// POST /auth/forgot-password — запрос ссылки на сброс.
// Всегда 200 (не палим, существует ли email). Письмо — best-effort.
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body; // нормализован схемой
    const user = await User.findOne({ where: { email } });

    if (user) {
      const { token, expiresAt } = generateResetToken();
      await user.update({ passwordResetToken: token, passwordResetExpiresAt: expiresAt });
      try {
        await sendPasswordResetEmail(user.email, user.name, token);
      } catch (mailErr) {
        console.error('Не удалось отправить письмо сброса:', mailErr);
        // не раскрываем ошибку клиенту — отвечаем как обычно
      }
    }

    res.json({ data: { message: 'Если такой email зарегистрирован — мы отправили ссылку для сброса.' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка запроса сброса пароля' });
  }
};

// POST /auth/reset-password — задать новый пароль по токену из письма
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({ where: { passwordResetToken: token } });
    if (!user) return res.status(400).json({ error: 'Неверная или устаревшая ссылка' });

    if (user.passwordResetExpiresAt && new Date(user.passwordResetExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Срок действия ссылки истёк. Запросите новую.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await user.update({
      password: hash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });

    res.json({ data: { message: 'Пароль обновлён. Теперь войдите с новым паролем.' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
};

module.exports = {
  register, registerTeacher, login, me, refresh, logout,
  verifyEmail, resendVerification, changePassword,
  forgotPassword, resetPassword,
};
