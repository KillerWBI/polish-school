'use strict';

// Учебные треки Фаза 3.7: теория к подтемам (генерируется при первом открытии, хранится навсегда).
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.map(t => (t.tableName || t)).includes('TrackTheories')) return;

    await queryInterface.createTable('TrackTheories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE',
      },
      topicId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Topics', key: 'id' }, onDelete: 'CASCADE',
      },
      stepId:  { type: Sequelize.STRING, allowNull: false },
      content: { type: Sequelize.JSONB, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    // Одна теория на подтему: два одновременных открытия не создадут дубль
    await queryInterface.addIndex('TrackTheories', ['topicId', 'stepId'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TrackTheories');
  },
};
