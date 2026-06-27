'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Posts', {
      id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      authorId:   { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      text:       { type: DataTypes.TEXT, allowNull: false },
      media:      { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      viewsCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt:  { type: DataTypes.DATE, allowNull: false },
      updatedAt:  { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('PostLikes', {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      postId:    { type: DataTypes.UUID, allowNull: false, references: { model: 'Posts', key: 'id' }, onDelete: 'CASCADE' },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });

    // Один пользователь лайкает пост максимум один раз
    await queryInterface.addIndex('PostLikes', ['userId', 'postId'], {
      unique: true,
      name: 'post_likes_user_post_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PostLikes');
    await queryInterface.dropTable('Posts');
  },
};
