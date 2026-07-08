'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Реквизиты оплаты учителя (BLIK, IBAN, PayPal, Revolut, кастомное)
    await queryInterface.addColumn('Users', 'paymentDetails', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });

    // Скриншот-подтверждение от ученика
    await queryInterface.addColumn('PaymentRecords', 'screenshotUrl', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Расширяем ENUM source: добавляем 'student' (ученик сам подал оплату со скриншотом)
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_PaymentRecords_source" ADD VALUE IF NOT EXISTS 'student'`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'paymentDetails');
    await queryInterface.removeColumn('PaymentRecords', 'screenshotUrl');
    // ENUM value нельзя удалить в PostgreSQL — оставляем
  },
};
