const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Обращение в поддержку: вопрос / проблема / вопрос по оплате.
// Может прийти от гостя (без auth) или залогиненного пользователя (userId).
const SupportTicket = sequelize.define('SupportTicket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Автор, если был залогинен (nullable — форма публичная)
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  name:    { type: DataTypes.STRING, allowNull: false },
  email:   { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: false },
  category: {
    type: DataTypes.ENUM('question', 'problem', 'billing'),
    allowNull: false,
    defaultValue: 'question',
  },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'resolved'),
    allowNull: false,
    defaultValue: 'open',
  },
  // Ответ администратора (отправляется на email автора)
  adminReply: { type: DataTypes.TEXT, allowNull: true },
  repliedAt:  { type: DataTypes.DATE, allowNull: true },
});

module.exports = SupportTicket;
