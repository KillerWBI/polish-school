'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('Users', 'emailVerified', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Users', 'emailVerificationToken', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'emailVerificationExpiresAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('Users', ['emailVerificationToken'], {
      name: 'users_email_verification_token_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Users', 'users_email_verification_token_idx');
    await queryInterface.removeColumn('Users', 'emailVerificationExpiresAt');
    await queryInterface.removeColumn('Users', 'emailVerificationToken');
    await queryInterface.removeColumn('Users', 'emailVerified');
  },
};
