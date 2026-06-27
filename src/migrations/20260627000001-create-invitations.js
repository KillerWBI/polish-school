'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Invitations', {
      id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      // отправитель — учитель
      teacherId:     { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      groupId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'Groups', key: 'id' }, onDelete: 'CASCADE' },
      // получатель — приглашаемый студент (аккаунт)
      inviteeUserId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      status:        { type: DataTypes.ENUM('pending', 'accepted', 'declined', 'revoked'), allowNull: false, defaultValue: 'pending' },
      createdAt:     { type: DataTypes.DATE, allowNull: false },
      updatedAt:     { type: DataTypes.DATE, allowNull: false },
    });

    // Анти-дубль: одно активное (pending) приглашение на пару (учитель, группа, получатель).
    // После decline/revoked можно пригласить повторно — поэтому unique частичный, не на всю таблицу.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "invitations_pending_unique" ON "Invitations" ("teacherId", "groupId", "inviteeUserId") WHERE "status" = \'pending\''
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Invitations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Invitations_status";');
  },
};
