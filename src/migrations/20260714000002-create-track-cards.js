'use strict';

// Учебные треки Фаза 2: флеш-карточки шага с интервальным повторением (SR).
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.map(t => (t.tableName || t)).includes('TrackCards')) return;

    await queryInterface.createTable('TrackCards', {
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
      topicId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Topics', key: 'id' },
        onDelete: 'CASCADE',
      },
      stepId: { type: Sequelize.STRING, allowNull: false },
      front:  { type: Sequelize.TEXT, allowNull: false },
      back:   { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.ENUM('new', 'learning', 'known'),
        allowNull: false,
        defaultValue: 'new',
      },
      correctStreak: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      nextReviewAt:  { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('TrackCards', ['userId', 'topicId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TrackCards');
    // чистим ENUM-тип (Postgres)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TrackCards_status";');
  },
};
