const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Личная заметка ученика. Может быть привязана к уроку (lessonId/individualLessonId)
// или быть самостоятельной записью-конспектом (title + text).
const StudentNote = sequelize.define('StudentNote', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  lessonId:           { type: DataTypes.UUID, allowNull: true },
  individualLessonId: { type: DataTypes.UUID, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: true },
  text:  { type: DataTypes.TEXT, allowNull: false },
});

module.exports = StudentNote;
