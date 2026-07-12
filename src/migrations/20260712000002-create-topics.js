'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Topics', {
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
      title:   { type: Sequelize.STRING, allowNull: false },
      subject: { type: Sequelize.STRING, allowNull: true },
      masteryPercent: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      attempts:       { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lastPracticedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('Topics', ['userId']);

    // Привязка попытки-теста к теме (Quiz используется как история практик)
    const quiz = await queryInterface.describeTable('Quizzes');
    if (!quiz.topicId) {
      await queryInterface.addColumn('Quizzes', 'topicId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Topics', key: 'id' },
        onDelete: 'CASCADE',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Quizzes', 'topicId');
    await queryInterface.dropTable('Topics');
  },
};
