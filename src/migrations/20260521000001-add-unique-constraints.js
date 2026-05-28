'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Уникальность урока группы: один слот дата+время в одной группе
    await queryInterface.addConstraint('Lessons', {
      fields: ['groupId', 'date', 'time'],
      type: 'unique',
      name: 'lessons_group_date_time_unique',
    });

    // Уникальность инд. урока: один слот дата+время в одном курсе
    await queryInterface.addConstraint('IndividualLessons', {
      fields: ['individualCourseId', 'date', 'time'],
      type: 'unique',
      name: 'individual_lessons_course_date_time_unique',
    });

    // Уникальность сдачи ДЗ: студент сдаёт одно задание один раз
    await queryInterface.addConstraint('HomeworkSubmissions', {
      fields: ['homeworkId', 'studentId'],
      type: 'unique',
      name: 'homework_submissions_hw_student_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('Lessons',             'lessons_group_date_time_unique');
    await queryInterface.removeConstraint('IndividualLessons',   'individual_lessons_course_date_time_unique');
    await queryInterface.removeConstraint('HomeworkSubmissions', 'homework_submissions_hw_student_unique');
  },
};
