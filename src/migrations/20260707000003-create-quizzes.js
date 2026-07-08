'use strict';

// Таблица сохранённых тестов (AI-генератор → «Мои тесты»). Идемпотентна:
// в dev таблицу мог создать sync — тогда пропускаем.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(t).toLowerCase());
    if (tables.includes('quizzes')) return;

    await queryInterface.createTable('Quizzes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      teacherId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      topic: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false, defaultValue: 'single' },
      difficulty: { type: Sequelize.STRING },
      language: { type: Sequelize.STRING },
      questions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Quizzes');
  },
};
