'use strict';

// Тариф учителя (SaaS): free / pro / school. Существующие пользователи → 'free'.
// Идемпотентна. Оплата подписки подключится позже (платёжный шлюз).
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table.plan) {
      await queryInterface.addColumn('Users', 'plan', {
        type: Sequelize.ENUM('free', 'pro', 'school'),
        allowNull: false,
        defaultValue: 'free',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'plan');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_plan";');
  },
};
