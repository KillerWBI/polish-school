const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Личная тема ученика для самостоятельной практики (любой предмет/вопрос).
// По теме генерируются адаптивные AI-тесты; masteryPercent считается по EMA от результатов.
const Topic = sequelize.define('Topic', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Владелец — ученик
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  title:   { type: DataTypes.STRING, allowNull: false },
  subject: { type: DataTypes.STRING, allowNull: true },
  // % обладания темой (текущий уровень по EMA), 0..100
  masteryPercent: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  // Сколько практик пройдено
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  lastPracticedAt: { type: DataTypes.DATE, allowNull: true },
});

module.exports = Topic;
