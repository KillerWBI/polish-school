const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// In-app уведомление пользователю (оценка, новое ДЗ, оплата, приглашение и т.д.).
// Email-канал добавится позже (нужен домен) — модель уже готова к расширению.
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Тип события — для иконки/группировки на клиенте
  type:  { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  body:  { type: DataTypes.STRING, allowNull: true },
  // Куда вести по клику (относительный путь фронта, напр. /homework)
  link:  { type: DataTypes.STRING, allowNull: true },
  // Прочитано (null = не прочитано)
  readAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = Notification;
