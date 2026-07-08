'use strict';

// Добавляет способ оплаты (method) и источник записи (source) в PaymentRecords.
// Идемпотентна: проверяет наличие колонок. Существующие строки получают defaults
// ('cash'/'manual') — историческая ручная оплата наличными.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('PaymentRecords');
    if (!table.method) {
      await queryInterface.addColumn('PaymentRecords', 'method', {
        type: Sequelize.ENUM('cash', 'card', 'transfer', 'online'),
        allowNull: false,
        defaultValue: 'cash',
      });
    }
    if (!table.source) {
      await queryInterface.addColumn('PaymentRecords', 'source', {
        type: Sequelize.ENUM('manual', 'online'),
        allowNull: false,
        defaultValue: 'manual',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('PaymentRecords', 'method');
    await queryInterface.removeColumn('PaymentRecords', 'source');
    // Postgres: удаляем enum-типы, созданные под колонки
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PaymentRecords_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PaymentRecords_source";');
  },
};
