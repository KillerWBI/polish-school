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
    type: DataTypes.ENUM('teacher', 'student'),
    allowNull: false,
    defaultValue: 'student',
  },
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
  socialTelegram: { type: DataTypes.STRING(64),  allowNull: true },
  socialWhatsApp: { type: DataTypes.STRING(32),  allowNull: true },
  socialLinkedIn: { type: DataTypes.STRING(128), allowNull: true },
  // [{ code: 'pl', level: 'B2' }] — у учителя level может быть null
  languages: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
});

module.exports = User;
