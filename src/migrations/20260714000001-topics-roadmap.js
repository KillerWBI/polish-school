'use strict';

// Учебные треки Phase 1: у темы — цель + роадмап подтем; у попытки — привязка к шагу.
module.exports = {
  async up(queryInterface, Sequelize) {
    const topics = await queryInterface.describeTable('Topics');
    if (!topics.goal) {
      await queryInterface.addColumn('Topics', 'goal', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!topics.roadmap) {
      await queryInterface.addColumn('Topics', 'roadmap', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
    }

    const quizzes = await queryInterface.describeTable('Quizzes');
    if (!quizzes.stepId) {
      await queryInterface.addColumn('Quizzes', 'stepId', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Quizzes', 'stepId');
    await queryInterface.removeColumn('Topics', 'roadmap');
    await queryInterface.removeColumn('Topics', 'goal');
  },
};
