const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Homework = sequelize.define('Homework', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // одно из двух — либо групповой урок, либо индивидуальный
  lessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  individualLessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Прикреплённый тест (из библиотеки учителя). null — теста нет.
  quizId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
});

module.exports = Homework;
