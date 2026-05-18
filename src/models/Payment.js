const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // формат: "2026-05"
  month: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // рассчитывается: кол-во посещений × pricePerLesson
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  paid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = Payment;
