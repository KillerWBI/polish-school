'use strict';

// Прикрепление теста к ДЗ + прохождения-в-ДЗ:
//   Homework.quizId       — прикреплённый тест (FK Quizzes, SET NULL при удалении теста)
//   Quiz.homeworkId       — если строка = прохождение теста в рамках ДЗ
//   Quiz.sourceQuizId     — исходный тест-библиотека, из которого проходили
// Идемпотентна.
module.exports = {
  async up(queryInterface, Sequelize) {
    const hw = await queryInterface.describeTable('Homework');
    if (!hw.quizId) {
      await queryInterface.addColumn('Homework', 'quizId', {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'Quizzes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      });
    }
    const quiz = await queryInterface.describeTable('Quizzes');
    if (!quiz.homeworkId) {
      await queryInterface.addColumn('Quizzes', 'homeworkId', { type: Sequelize.UUID, allowNull: true });
    }
    if (!quiz.sourceQuizId) {
      await queryInterface.addColumn('Quizzes', 'sourceQuizId', { type: Sequelize.UUID, allowNull: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Homework', 'quizId');
    await queryInterface.removeColumn('Quizzes', 'homeworkId');
    await queryInterface.removeColumn('Quizzes', 'sourceQuizId');
  },
};
