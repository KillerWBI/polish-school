'use strict';

/**
 * Подписки на push-уведомления.
 *
 * Строка = один браузер на одном устройстве, а НЕ один пользователь: человек с телефоном
 * и ноутбуком подписывается дважды и должен получать push на оба. Поэтому отдельная
 * таблица со связью many-to-one, а не колонка в Users.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PushSubscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        // Удалили пользователя — его подписки бессмысленны и должны уйти вместе с ним
        onDelete: 'CASCADE',
      },
      // Адрес, который выдал push-сервис браузера (FCM у Chrome, Mozilla у Firefox,
      // Apple у Safari). Именно на этот URL сервер шлёт POST.
      endpoint: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      // Ключи шифрования тела. Без них push-сервис получил бы открытый текст,
      // а он посредник и содержимое уведомления знать не должен.
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth:   { type: Sequelize.TEXT, allowNull: false },
      // Чтобы человек в настройках понимал, какое из устройств отключает
      userAgent: { type: Sequelize.STRING(255), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    // Endpoint уникален глобально: он и есть личность подписки. Уникальность нужна не для
    // красоты — при повторной подписке того же браузера (переустановка, смена разрешения)
    // приходит тот же endpoint, и без индекса накопились бы дубли, а значит и дубли push.
    await queryInterface.addIndex('PushSubscriptions', ['endpoint'], {
      unique: true,
      name: 'push_subscriptions_endpoint_unique',
    });
    // Горячий путь: «все подписки этого пользователя» на каждое уведомление
    await queryInterface.addIndex('PushSubscriptions', ['userId'], {
      name: 'push_subscriptions_user_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PushSubscriptions');
  },
};
