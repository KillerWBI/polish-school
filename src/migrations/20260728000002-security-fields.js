'use strict';

// passwordChangedAt      — отзыв старых refresh-токенов при смене/сбросе пароля
// subscriptionEventAt    — отметка времени последнего обработанного события Paddle
//                          (защита от out-of-order доставки вебхуков)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'passwordChangedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'subscriptionEventAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'passwordChangedAt');
    await queryInterface.removeColumn('Users', 'subscriptionEventAt');
  },
};
