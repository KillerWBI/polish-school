const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Заявка студента на обучение у учителя.
// Требует accept учителя → создаётся отношение TeacherStudent.
// Контакт сохраняется снапшотом (на момент заявки), чтобы связь была даже
// если в профиле студента контактов нет — он вводит их в форме заявки.
const LessonRequest = sequelize.define('LessonRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Язык, на который записывается (из языков, которые ведёт учитель)
  language: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Уровень студента — опционально (A1..C2 или null)
  level: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Сопроводительное сообщение учителю
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Способ связи + значение (снапшот из профиля или введён в форме)
  contactMethod: {
    type: DataTypes.ENUM('telegram', 'whatsapp', 'instagram', 'phone'),
    allowNull: false,
  },
  contactValue: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  // Быстрый доступ к входящим заявкам учителя по статусу
  indexes: [{ fields: ['teacherId', 'status'] }],
});

module.exports = LessonRequest;
