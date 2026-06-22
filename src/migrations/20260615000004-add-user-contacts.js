'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const cols = await queryInterface.describeTable('Users');
    if (!cols.socialInstagram) {
      await queryInterface.addColumn('Users', 'socialInstagram', { type: DataTypes.STRING(64), allowNull: true });
    }
    if (!cols.phone) {
      await queryInterface.addColumn('Users', 'phone', { type: DataTypes.STRING(32), allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'phone');
    await queryInterface.removeColumn('Users', 'socialInstagram');
  },
};
