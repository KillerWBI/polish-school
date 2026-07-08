'use strict';

// Добавляет значение 'admin' в ENUM role и поле 'active' (deactivate-поддержка).
// ALTER TYPE ... ADD VALUE нельзя откатить в PostgreSQL — down() — no-op.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Users_role" ADD VALUE IF NOT EXISTS 'admin'`
    );
    await queryInterface.addColumn('Users', 'active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  async down() {
    // ENUM value removal не поддерживается PostgreSQL — no-op
  },
};
