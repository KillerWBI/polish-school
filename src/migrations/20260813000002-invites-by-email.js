'use strict';

/**
 * Приглашения тем, кого ещё нет на платформе — обе виральные петли.
 *
 * Было: пригласить можно только зарегистрированного (`Invitation.inviteeUserId`
 * обязателен, поиск по нику). То есть механика работала лишь ВНУТРИ платформы и
 * ничего не приводила снаружи.
 *
 * Стало:
 *   Invitations  — приглашение по email с одноразовым токеном; inviteeUserId
 *                  становится nullable (в момент отправки аккаунта ещё нет).
 *   Users        — кто кого привёл: без этого невозможно понять, работает ли петля.
 *   StudentTeachers — ученик зовёт своего офлайн-преподавателя на платформу.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Приглашение учитель → ученик по email ---
    await queryInterface.addColumn('Invitations', 'inviteeEmail', {
      type: Sequelize.STRING, allowNull: true,
    });
    // Токен уникален: по нему ищем приглашение при регистрации, поиск идёт по индексу
    await queryInterface.addColumn('Invitations', 'token', {
      type: Sequelize.STRING(64), allowNull: true, unique: true,
    });
    // Приглашение не должно жить вечно: утёкшая ссылка перестаёт работать сама
    await queryInterface.addColumn('Invitations', 'expiresAt', {
      type: Sequelize.DATE, allowNull: true,
    });
    // Приглашаем того, кого ещё нет — значит userId на момент создания неизвестен.
    // Заполнится, когда человек зарегистрируется по ссылке.
    await queryInterface.changeColumn('Invitations', 'inviteeUserId', {
      type: Sequelize.UUID, allowNull: true,
    });

    // --- Атрибуция: кто кого привёл ---
    await queryInterface.addColumn('Users', 'invitedByUserId', {
      type: Sequelize.UUID, allowNull: true,
    });

    // --- Приглашение ученик → преподаватель ---
    // Карточка офлайн-преподавателя превращается в приглашение: ученик вводит email,
    // преподаватель получает письмо и регистрируется.
    await queryInterface.addColumn('StudentTeachers', 'inviteEmail', {
      type: Sequelize.STRING, allowNull: true,
    });
    await queryInterface.addColumn('StudentTeachers', 'inviteToken', {
      type: Sequelize.STRING(64), allowNull: true, unique: true,
    });
    await queryInterface.addColumn('StudentTeachers', 'inviteSentAt', {
      type: Sequelize.DATE, allowNull: true,
    });
    // Преподаватель зарегистрировался — связываем карточку с его аккаунтом,
    // чтобы не звать второй раз и показать ученику, что тот уже здесь.
    await queryInterface.addColumn('StudentTeachers', 'linkedUserId', {
      type: Sequelize.UUID, allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('StudentTeachers', 'linkedUserId');
    await queryInterface.removeColumn('StudentTeachers', 'inviteSentAt');
    await queryInterface.removeColumn('StudentTeachers', 'inviteToken');
    await queryInterface.removeColumn('StudentTeachers', 'inviteEmail');
    await queryInterface.removeColumn('Users', 'invitedByUserId');
    // Возврат NOT NULL безопасен только если строк без userId нет — чистим их
    await queryInterface.sequelize.query('DELETE FROM "Invitations" WHERE "inviteeUserId" IS NULL');
    await queryInterface.changeColumn('Invitations', 'inviteeUserId', {
      type: Sequelize.UUID, allowNull: false,
    });
    await queryInterface.removeColumn('Invitations', 'expiresAt');
    await queryInterface.removeColumn('Invitations', 'token');
    await queryInterface.removeColumn('Invitations', 'inviteeEmail');
  },
};
