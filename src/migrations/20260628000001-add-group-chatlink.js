'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const cols = await queryInterface.describeTable('Groups');
    if (!cols.chatLink) {
      // ссылка на внешний чат группы (Telegram/WhatsApp) — по образцу lessonLink
      await queryInterface.addColumn('Groups', 'chatLink', { type: DataTypes.STRING, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Groups', 'chatLink');
  },
};
