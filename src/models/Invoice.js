const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Счёт на оплату: снимок расчёта за период на момент выставления.
// Позиции и валюта копируются в документ — правки цен задним числом его не меняют.
const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacherId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Student, а не User: счёт можно выставить и ученику без аккаунта.
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Сквозной номер внутри одного преподавателя (уникальность — индексом в БД).
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'PLN',
  },
  periodFrom: { type: DataTypes.DATEONLY, allowNull: false },
  periodTo:   { type: DataTypes.DATEONLY, allowNull: false },
  issuedAt:   { type: DataTypes.DATEONLY, allowNull: false },
  dueDate:    { type: DataTypes.DATEONLY, allowNull: true },
  // [{ date, title, price }] — строка на каждое посещённое занятие
  positions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  // issued — выставлен, paid — закрыт оплатой, cancelled — отозван преподавателем
  status: {
    type: DataTypes.ENUM('issued', 'paid', 'cancelled'),
    allowNull: false,
    defaultValue: 'issued',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Invoice;
