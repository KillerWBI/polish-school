'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StudentLessonLogs', {
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
      teacherLabel: { type: Sequelize.STRING, allowNull: true },
      subject:      { type: Sequelize.STRING, allowNull: false },
      date:         { type: Sequelize.DATEONLY, allowNull: false },
      time:         { type: Sequelize.STRING, allowNull: true },
      durationMin:  { type: Sequelize.INTEGER, allowNull: true },
      topic:        { type: Sequelize.STRING, allowNull: true },
      notes:        { type: Sequelize.TEXT, allowNull: true },
      pricePerLesson: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },
      isPaid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      paidAt: { type: Sequelize.DATE, allowNull: true },
      type: {
        type: Sequelize.ENUM('external', 'self_study'),
        allowNull: false,
        defaultValue: 'external',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('StudentLessonLogs', ['userId', 'date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StudentLessonLogs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_StudentLessonLogs_type"');
  },
};
