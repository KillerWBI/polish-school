'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Follows', {
      id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      followerId:  { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      followingId: { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      createdAt:   { type: DataTypes.DATE, allowNull: false },
      updatedAt:   { type: DataTypes.DATE, allowNull: false },
    });

    // Нельзя подписаться на одного человека дважды
    await queryInterface.addIndex('Follows', ['followerId', 'followingId'], {
      unique: true,
      name: 'follows_follower_following_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Follows');
  },
};
