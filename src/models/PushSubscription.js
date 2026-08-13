const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Подписка одного браузера на одном устройстве. У пользователя их может быть несколько.
const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Адрес от push-сервиса браузера — личность подписки (уникальность держит индекс в БД)
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // Ключи шифрования тела: посредник не должен читать содержимое
  p256dh: { type: DataTypes.TEXT, allowNull: false },
  auth:   { type: DataTypes.TEXT, allowNull: false },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
});

module.exports = PushSubscription;
