const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Источник (книга/ссылка), привязанный к подтеме-шагу учебного трека.
// Предлагается ИИ, проходит проверку существования (verified). Виден на странице трека.
const TrackSource = sequelize.define('TrackSource', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId:  { type: DataTypes.UUID, allowNull: false },
  topicId: { type: DataTypes.UUID, allowNull: false },
  stepId:  { type: DataTypes.STRING, allowNull: false },
  type:   { type: DataTypes.ENUM('book', 'link'), allowNull: false, defaultValue: 'link' },
  title:  { type: DataTypes.TEXT, allowNull: false },
  author: { type: DataTypes.STRING, allowNull: true },
  url:    { type: DataTypes.TEXT, allowNull: true },
  // true — прошёл проверку существования; false — «менее проверенный» (по запросу пользователя)
  verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

module.exports = TrackSource;
