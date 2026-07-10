const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Слово/фраза в личном словаре ученика. Тренируется интервальными повторениями (SR).
// Универсально: для языка — слово+перевод, для других предметов — термин+определение.
const VocabItem = sequelize.define('VocabItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Владелец — сам ученик (User.id)
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  word:        { type: DataTypes.STRING, allowNull: false },
  translation: { type: DataTypes.STRING, allowNull: false },
  example:     { type: DataTypes.TEXT, allowNull: true },
  // Статус освоения
  status: {
    type: DataTypes.ENUM('new', 'learning', 'known'),
    allowNull: false,
    defaultValue: 'new',
  },
  // Сколько верных ответов подряд (для интервала SR)
  correctStreak: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  // Когда слово снова покажется на повторение
  nextReviewAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = VocabItem;
