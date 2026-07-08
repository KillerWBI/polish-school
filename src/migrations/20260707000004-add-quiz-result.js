'use strict';

// Ответы пользователя + результат прохождения в сохранённом тесте. Идемпотентна.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Quizzes');
    if (!table.answers) {
      await queryInterface.addColumn('Quizzes', 'answers', {
        type: Sequelize.JSONB, allowNull: false, defaultValue: {},
      });
    }
    if (!table.score) {
      await queryInterface.addColumn('Quizzes', 'score', { type: Sequelize.INTEGER, allowNull: true });
    }
    if (!table.total) {
      await queryInterface.addColumn('Quizzes', 'total', { type: Sequelize.INTEGER, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Quizzes', 'answers');
    await queryInterface.removeColumn('Quizzes', 'score');
    await queryInterface.removeColumn('Quizzes', 'total');
  },
};
