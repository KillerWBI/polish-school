const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Личный журнал ученика для учёта занятий ВНЕ платформы (другой репетитор/школа)
// или самостоятельного обучения. Не связан с Lesson/Teacher — это просто записи ученика.
const StudentLessonLog = sequelize.define('StudentLessonLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Владелец записи — сам ученик
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Имя преподавателя/источника — просто строка (не FK): «Пан Войтек», «Duolingo», «сам»
  teacherLabel: { type: DataTypes.STRING, allowNull: true },
  subject:      { type: DataTypes.STRING, allowNull: false },
  date:         { type: DataTypes.DATEONLY, allowNull: false },
  time:         { type: DataTypes.STRING, allowNull: true },   // 'HH:MM' или null
  durationMin:  { type: DataTypes.INTEGER, allowNull: true },
  topic:        { type: DataTypes.STRING, allowNull: true },
  notes:        { type: DataTypes.TEXT, allowNull: true },
  pricePerLesson: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  paidAt: { type: DataTypes.DATE, allowNull: true },
  // external = занятие с кем-то вне платформы; self_study = самостоятельное
  type: {
    type: DataTypes.ENUM('external', 'self_study'),
    allowNull: false,
    defaultValue: 'external',
  },
});

module.exports = StudentLessonLog;
