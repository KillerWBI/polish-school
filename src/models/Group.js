const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Group = sequelize.define('Group', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // [{day: 1, time: "18:00"}] — 0=Вс, 1=Пн, ..., 6=Сб
  schedule: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  lessonLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // ссылка на внешний чат группы (Telegram/WhatsApp)
  chatLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pricePerLesson: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
});

module.exports = Group;
