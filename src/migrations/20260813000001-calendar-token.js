'use strict';

/**
 * Токен подписки на календарь.
 *
 * Ссылку вида /calendar/<token>.ics запрашивает не браузер пользователя, а сервер
 * Google/Apple — он ходит по расписанию, без куки и без заголовка авторизации.
 * Значит секретом должна быть сама ссылка: длинный случайный токен в пути.
 *
 * nullable намеренно: токен выдаётся при первом нажатии «Подписаться», а не всем
 * подряд при регистрации. Не выданный токен невозможно утащить.
 *
 * unique — чтобы поиск по токену шёл по индексу (на каждый визит календаря
 * это один запрос) и чтобы коллизия, даже теоретическая, отвалилась на вставке.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'calendarToken', {
      type: Sequelize.STRING(64),
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'calendarToken');
  },
};
