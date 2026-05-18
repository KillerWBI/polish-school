const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lesson = sequelize.define('Lesson', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // переопределяет lessonLink группы для конкретного урока
  lessonLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // [{type: 'link'|'file'|'text', url?, content?, title?}]
  materials: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
});

module.exports = Lesson;
