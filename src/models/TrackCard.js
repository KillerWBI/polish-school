const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Флеш-карточка учебного трека (генерируется ИИ по подтеме-шагу).
// Тренируется интервальным повторением (SR) — поля как у VocabItem.
const TrackCard = sequelize.define('TrackCard', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Владелец — ученик (User.id)
  userId: { type: DataTypes.UUID, allowNull: false },
  // Трек и его шаг, к которым относится карточка
  topicId: { type: DataTypes.UUID, allowNull: false },
  stepId:  { type: DataTypes.STRING, allowNull: false },
  front: { type: DataTypes.TEXT, allowNull: false },
  back:  { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('new', 'learning', 'known'),
    allowNull: false,
    defaultValue: 'new',
  },
  correctStreak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  nextReviewAt:  { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});

module.exports = TrackCard;
