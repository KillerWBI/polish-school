'use strict';

// «Мои преподаватели» — карточки, которые ученик заводит сам для тех, кого нет на платформе
// (репетитор офлайн, школьный учитель, курсы) и для самостоятельных занятий по предмету.
// Занятие в личном журнале получает ссылку на карточку: раньше преподаватель и предмет
// вписывались строкой заново при каждой записи, поэтому «Пан Войтек» и «пан войтек»
// оказывались разными людьми, а вести долг по конкретному человеку было нельзя.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('StudentTeachers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name:           { type: Sequelize.STRING, allowNull: false },
      subject:        { type: Sequelize.STRING, allowNull: false },
      pricePerLesson: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      contact:        { type: Sequelize.STRING, allowNull: true },
      notes:          { type: Sequelize.TEXT, allowNull: true },
      createdAt:      { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt:      { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    // Выборка «мои преподаватели» идёт по владельцу на каждой загрузке страницы
    await queryInterface.addIndex('StudentTeachers', ['userId'], { name: 'student_teachers_user_idx' });

    const t = await queryInterface.describeTable('StudentLessonLogs');
    if (!t.studentTeacherId) {
      await queryInterface.addColumn('StudentLessonLogs', 'studentTeacherId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'StudentTeachers', key: 'id' },
        // Карточку удалили — занятия остаются, имя в них сохранено в teacherLabel
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('StudentLessonLogs', ['studentTeacherId'], {
        name: 'student_lesson_logs_teacher_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('StudentLessonLogs', 'student_lesson_logs_teacher_idx');
    await queryInterface.removeColumn('StudentLessonLogs', 'studentTeacherId');
    await queryInterface.dropTable('StudentTeachers');
  },
};
