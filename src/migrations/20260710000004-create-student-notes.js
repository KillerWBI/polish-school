'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StudentNotes', {
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
      lessonId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Lessons', key: 'id' },
        onDelete: 'CASCADE',
      },
      individualLessonId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'IndividualLessons', key: 'id' },
        onDelete: 'CASCADE',
      },
      title:     { type: Sequelize.STRING, allowNull: true },
      text:      { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('StudentNotes', ['userId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StudentNotes');
  },
};
