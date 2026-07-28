'use strict';

// Новый тариф «Базовый» (basic) между free и pro.
// ENUM-значение нельзя добавить внутри транзакции вместе с его использованием,
// поэтому отдельная миграция без queryInterface-транзакции.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Users_plan" ADD VALUE IF NOT EXISTS 'basic' AFTER 'free'`
    );
  },

  // Postgres не умеет удалять значение из ENUM. Откат — пересоздание типа,
  // что при живых данных опаснее самой миграции, поэтому down — no-op.
  async down() {},
};
