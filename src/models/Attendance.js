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
  // Итоговый результат: null = ожидает подтверждения, true = присутствовал, false = отсутствовал/спор
  present: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
  },
  // Что отметил учитель
  teacherMarked: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
  },
  // Что подтвердил студент
  studentMarked: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: null,
  },
  // Статус двойного подтверждения
  status: {
    type: DataTypes.ENUM('pending_student', 'confirmed', 'disputed'),
    allowNull: false,
    defaultValue: 'confirmed',
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
