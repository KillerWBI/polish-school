'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('VocabItems', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      word:        { type: Sequelize.STRING, allowNull: false },
      translation: { type: Sequelize.STRING, allowNull: false },
      example:     { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('new', 'learning', 'known'),
        allowNull: false,
        defaultValue: 'new',
      },
      correctStreak: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      nextReviewAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('VocabItems', ['userId', 'nextReviewAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('VocabItems');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_VocabItems_status"');
  },
};
