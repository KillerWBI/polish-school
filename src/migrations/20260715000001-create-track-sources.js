'use strict';

// Учебные треки Фаза 2: сохранённые источники (книги/ссылки) к шагам трека.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.map(t => (t.tableName || t)).includes('TrackSources')) return;

    await queryInterface.createTable('TrackSources', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE',
      },
      topicId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Topics', key: 'id' }, onDelete: 'CASCADE',
      },
      stepId: { type: Sequelize.STRING, allowNull: false },
      type:   { type: Sequelize.ENUM('book', 'link'), allowNull: false, defaultValue: 'link' },
      title:  { type: Sequelize.TEXT, allowNull: false },
      author: { type: Sequelize.STRING, allowNull: true },
      url:    { type: Sequelize.TEXT, allowNull: true },
      verified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('TrackSources', ['userId', 'topicId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TrackSources');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TrackSources_type";');
  },
};
