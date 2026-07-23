'use strict';

// Дневной лимит ИИ-запросов: счётчик на User (сбрасывается при смене даты).
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.describeTable('Users');
    if (!t.aiUsageDate) {
      await queryInterface.addColumn('Users', 'aiUsageDate', { type: Sequelize.STRING, allowNull: true });
    }
    if (!t.aiUsageCount) {
      await queryInterface.addColumn('Users', 'aiUsageCount', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'aiUsageCount');
    await queryInterface.removeColumn('Users', 'aiUsageDate');
  },
};
