const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// «Мой преподаватель» — карточка, которую ученик заводит сам для того, кого нет на платформе
// (репетитор офлайн, школьный учитель, курсы) или для самостоятельных занятий по предмету.
// Зеркало ученика без аккаунта у преподавателя: записи ведёт владелец карточки, никому ничего не приходит.
const StudentTeacher = sequelize.define('StudentTeacher', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // Владелец карточки — сам ученик
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name:    { type: DataTypes.STRING, allowNull: false },  // «Пан Войтек», «Школа №7», «Сам»
  subject: { type: DataTypes.STRING, allowNull: false },  // предмет по умолчанию для его занятий
  // Цена по умолчанию — подставляется в новое занятие, но в занятии её можно поменять
  pricePerLesson: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  contact: { type: DataTypes.STRING, allowNull: true },   // телефон/телеграм/почта — как удобно
  notes:   { type: DataTypes.TEXT, allowNull: true },
});

module.exports = StudentTeacher;
