const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Один факт оплаты: ученик заплатил учителю сумму в определённый момент.
// Каждая оплата — отдельная строка. Сколько всего оплачено учителю = SUM(amount)
// по строкам этого (studentId, teacherId). Месяца нет — оплата по факту.
const PaymentRecord = sequelize.define('PaymentRecord', {
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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = PaymentRecord;
