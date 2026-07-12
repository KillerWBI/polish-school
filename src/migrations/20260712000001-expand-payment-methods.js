'use strict';

// Расширяем способы оплаты: BLIK / PayPal / Revolut / other (доп. каналы учителя).
// Postgres: ALTER TYPE ... ADD VALUE (нельзя откатить → down = no-op).
module.exports = {
  async up(queryInterface) {
    const vals = ['blik', 'paypal', 'revolut', 'other'];
    for (const v of vals) {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_PaymentRecords_method" ADD VALUE IF NOT EXISTS '${v}'`
      );
    }
  },

  async down() {
    // Удаление значений ENUM в Postgres не поддерживается — no-op.
  },
};
