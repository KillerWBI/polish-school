'use strict';

const { DataTypes } = require('sequelize');

// Идемпотентна: dev-sync({alter}) мог уже добавить колонки в общую БД,
// поэтому добавляем/индексируем только если их ещё нет — иначе db:migrate на проде упадёт.
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('Users');

    if (!table.passwordResetToken) {
      await queryInterface.addColumn('Users', 'passwordResetToken', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
    if (!table.passwordResetExpiresAt) {
      await queryInterface.addColumn('Users', 'passwordResetExpiresAt', {
        type: DataTypes.DATE,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('Users');
    if (!indexes.some((i) => i.name === 'users_password_reset_token_idx')) {
      await queryInterface.addIndex('Users', ['passwordResetToken'], {
        name: 'users_password_reset_token_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', 'users_password_reset_token_idx');
    await queryInterface.removeColumn('Users', 'passwordResetExpiresAt');
    await queryInterface.removeColumn('Users', 'passwordResetToken');
  },
};
