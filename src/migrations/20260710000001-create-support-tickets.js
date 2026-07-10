'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SupportTickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      name:    { type: Sequelize.STRING, allowNull: false },
      email:   { type: Sequelize.STRING, allowNull: false },
      subject: { type: Sequelize.STRING, allowNull: false },
      category: {
        type: Sequelize.ENUM('question', 'problem', 'billing'),
        allowNull: false,
        defaultValue: 'question',
      },
      message: { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.ENUM('open', 'in_progress', 'resolved'),
        allowNull: false,
        defaultValue: 'open',
      },
      adminReply: { type: Sequelize.TEXT, allowNull: true },
      repliedAt:  { type: Sequelize.DATE, allowNull: true },
      createdAt:  { type: Sequelize.DATE, allowNull: false },
      updatedAt:  { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SupportTickets');
    // Чистим ENUM-типы, созданные этой миграцией
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SupportTickets_category"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SupportTickets_status"');
  },
};
