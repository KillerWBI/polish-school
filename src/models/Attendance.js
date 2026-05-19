const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  lessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  individualLessonId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  present: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  // Уникальные индексы защищают от дублей при bulkCreate.
  // PostgreSQL считает NULL != NULL, поэтому строки с lessonId=NULL не конфликтуют
  // между собой — что и нужно для инд. уроков.
  indexes: [
    { unique: true, fields: ['lessonId', 'studentId'],           name: 'attendance_lesson_student_unique' },
    { unique: true, fields: ['individualLessonId', 'studentId'], name: 'attendance_indlesson_student_unique' },
  ],
});

module.exports = Attendance;
