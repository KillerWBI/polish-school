'use strict';

// Снос старой помесячной системы оплат (Payment). Долг теперь считается
// живьём из посещений, а факт оплаты лежит в PaymentRecords.
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('Payments');
  },

  // Откат — пересоздаём таблицу по исходной схеме (данные не восстанавливаются).
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('Payments', {
      id:        { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      studentId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      month:     { type: Sequelize.STRING, allowNull: false },
      amount:    { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      paid:      { type: Sequelize.BOOLEAN, defaultValue: false },
      paidAt:    { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
};
