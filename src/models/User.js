const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('teacher', 'student', 'admin'),
    allowNull: false,
    defaultValue: 'student',
  },
  // Деактивация аккаунта администратором
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  // Кто привёл этого пользователя (виральная петля). Без атрибуции невозможно
  // понять, работают ли приглашения, — и решения по росту делались бы вслепую.
  invitedByUserId: { type: DataTypes.UUID, allowNull: true },
  // Токен подписки на .ics-календарь. Выдаётся по кнопке «Подписаться», не всем сразу:
  // ссылку запрашивает сервер Google/Apple без авторизации, поэтому секрет — сама ссылка.
  calendarToken: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  // Валюта преподавателя (ISO-4217). В ней хранятся и считаются все его цены,
  // начисления и оплаты. Ученику показывается она же + справочное «≈» в его валюте.
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'PLN',
  },
  // Тариф учителя (SaaS-подписка). Управляется вебхуками Paddle (billing).
  plan: {
    type: DataTypes.ENUM('free', 'basic', 'pro', 'school'),
    allowNull: false,
    defaultValue: 'free',
  },
  // Paddle billing — идентификаторы подписки (для управления/отмены)
  paddleCustomerId:     { type: DataTypes.STRING, allowNull: true },
  paddleSubscriptionId: { type: DataTypes.STRING, allowNull: true },
  subscriptionStatus:   { type: DataTypes.STRING, allowNull: true }, // active/trialing/past_due/canceled…
  // occurred_at последнего применённого события Paddle — вебхуки приходят вне порядка
  subscriptionEventAt:  { type: DataTypes.DATE, allowNull: true },
  // Момент смены пароля — refresh-токены, выданные раньше, считаются отозванными
  passwordChangedAt:    { type: DataTypes.DATE, allowNull: true },
  // Дневной лимит ИИ-запросов: дата (YYYY-MM-DD) + счётчик за этот день
  aiUsageDate:  { type: DataTypes.STRING, allowNull: true },
  aiUsageCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // Email verification (Resend)
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailVerificationExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Восстановление пароля (Resend)
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passwordResetExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Профиль (Instagram-style)
  username: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
    validate: { is: /^[a-z0-9_]{3,40}$/ },
  },
  avatar:     { type: DataTypes.STRING,      allowNull: true },
  coverImage: { type: DataTypes.STRING,      allowNull: true },
  bio:        { type: DataTypes.TEXT,        allowNull: true, validate: { len: [0, 300] } },
  socialTelegram:  { type: DataTypes.STRING(64),  allowNull: true },
  socialWhatsApp:  { type: DataTypes.STRING(32),  allowNull: true },
  socialLinkedIn:  { type: DataTypes.STRING(128), allowNull: true },
  socialInstagram: { type: DataTypes.STRING(64),  allowNull: true },
  phone:           { type: DataTypes.STRING(32),  allowNull: true },
  // [{ code: 'pl', level: 'B2' }] — у учителя level может быть null
  languages: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  // Реквизиты оплаты учителя (куда переводить деньги за занятия)
  paymentDetails: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
});

module.exports = User;
