const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Ученик-запись в ростере учителя (фундамент C1, REVISION.md §2.1).
// Единая сущность: заглушка (userId=null, только для учителя) ИЛИ реальный (userId=аккаунт).
// teacherId — владелец-учитель (per-teacher: один человек у двух учителей = две строки Student).
const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // null → заглушка; заполнен → привязан к реальному аккаунту
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // контакт для учителя (телефон/ник/заметка) — у заглушек заполняется вручную
  contact: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Student;
