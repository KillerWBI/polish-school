'use strict';

// Модерация оплат ученика: status (pending/approved/rejected) + причина отказа + время рассмотрения.
// Дефолт 'approved' — существующие записи (учительские/сид) остаются засчитанными.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('PaymentRecords');

    if (!table.status) {
      await queryInterface.addColumn('PaymentRecords', 'status', {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'approved',
      });
    }
    if (!table.rejectionReason) {
      await queryInterface.addColumn('PaymentRecords', 'rejectionReason', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!table.reviewedAt) {
      await queryInterface.addColumn('PaymentRecords', 'reviewedAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PaymentRecords', 'status');
    await queryInterface.removeColumn('PaymentRecords', 'rejectionReason');
    await queryInterface.removeColumn('PaymentRecords', 'reviewedAt');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PaymentRecords_status"');
  },
};
