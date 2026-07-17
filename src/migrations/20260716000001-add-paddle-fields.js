'use strict';

// Подписки через Paddle: идентификаторы клиента/подписки на User.
module.exports = {
  async up(queryInterface, Sequelize) {
    const t = await queryInterface.describeTable('Users');
    if (!t.paddleCustomerId) {
      await queryInterface.addColumn('Users', 'paddleCustomerId', { type: Sequelize.STRING, allowNull: true });
    }
    if (!t.paddleSubscriptionId) {
      await queryInterface.addColumn('Users', 'paddleSubscriptionId', { type: Sequelize.STRING, allowNull: true });
    }
    if (!t.subscriptionStatus) {
      await queryInterface.addColumn('Users', 'subscriptionStatus', { type: Sequelize.STRING, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'subscriptionStatus');
    await queryInterface.removeColumn('Users', 'paddleSubscriptionId');
    await queryInterface.removeColumn('Users', 'paddleCustomerId');
  },
};
