const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Теория к подтеме-шагу учебного трека. Пишется ИИ при первом открытии подтемы и хранится
// навсегда — повторное открытие не тратит лимит ИИ. Одна запись на подтему (уникальный индекс).
// Отдельная таблица, а не поле в Topic.roadmap: roadmap целиком перезаписывается при каждой
// попытке теста (applyStepResult) — параллельная запись теории затёрла бы результат или наоборот.
const TrackTheory = sequelize.define('TrackTheory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId:  { type: DataTypes.UUID, allowNull: false },
  topicId: { type: DataTypes.UUID, allowNull: false },
  stepId:  { type: DataTypes.STRING, allowNull: false },
  // { summary, sections: [{ title, text, points: [] }], examples: [{ task, solution }], mistakes: [] }
  content: { type: DataTypes.JSONB, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['topicId', 'stepId'] }],
});

module.exports = TrackTheory;
