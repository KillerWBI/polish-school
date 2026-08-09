'use strict';

/**
 * Индексы на горячих внешних ключах.
 *
 * До этой миграции индексов не было почти нигде: Postgres не создаёт индекс на
 * колонку с REFERENCES автоматически (в отличие от MySQL). Каждый запрос вида
 * «уроки этого учителя» / «оплаты этого ученика» шёл Seq Scan по всей таблице.
 *
 * Не добавляем то, что уже покрыто существующим индексом по префиксу:
 *   Lessons.groupId              — покрыт lessons_group_date_time_unique
 *   IndividualLessons.courseId   — покрыт individual_lessons_course_date_time_unique
 *   HomeworkSubmissions.homeworkId — покрыт homework_submissions_hw_student_unique
 *   Attendances.lessonId / .individualLessonId — покрыты attendance_*_unique
 *
 * @type {import('sequelize-cli').Migration}
 */

// [таблица, поля, имя] — имя задаём явно, иначе Postgres обрежет автогенерированное
const INDEXES = [
  ['Groups',              ['teacherId'],               'groups_teacher_idx'],
  ['GroupStudents',       ['groupId'],                 'group_students_group_idx'],
  ['GroupStudents',       ['studentId'],               'group_students_student_idx'],
  ['Students',            ['teacherId'],               'students_teacher_idx'],
  ['Students',            ['userId'],                  'students_user_idx'],
  ['PaymentRecords',      ['teacherId', 'status'],     'payment_records_teacher_status_idx'],
  ['PaymentRecords',      ['studentId'],               'payment_records_student_idx'],
  ['IndividualCourses',   ['teacherId'],               'individual_courses_teacher_idx'],
  ['IndividualCourses',   ['studentId'],               'individual_courses_student_idx'],
  ['IndividualLessons',   ['teacherId'],               'individual_lessons_teacher_idx'],
  ['IndividualLessons',   ['studentId'],               'individual_lessons_student_idx'],
  ['Attendances',         ['studentId'],               'attendances_student_idx'],
  ['Attendances',         ['status'],                  'attendances_status_idx'],
  ['Homeworks',           ['lessonId'],                'homeworks_lesson_idx'],
  ['Homeworks',           ['individualLessonId'],      'homeworks_indlesson_idx'],
  ['HomeworkSubmissions', ['studentId'],               'homework_submissions_student_idx'],
  ['Invitations',         ['inviteeUserId', 'status'], 'invitations_invitee_status_idx'],
  ['Invitations',         ['teacherId', 'status'],     'invitations_teacher_status_idx'],
  ['Quizzes',             ['teacherId'],               'quizzes_teacher_idx'],
];

module.exports = {
  async up(queryInterface) {
    for (const [table, fields, name] of INDEXES) {
      // Таблицы соц-слоя могли не создаваться на чистой БД — не роняем миграцию из-за одной
      try {
        await queryInterface.addIndex(table, fields, { name });
      } catch (e) {
        console.warn(`  индекс ${name} не создан: ${e.message}`);
      }
    }
  },

  async down(queryInterface) {
    for (const [table, , name] of INDEXES) {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (e) {
        console.warn(`  индекс ${name} не удалён: ${e.message}`);
      }
    }
  },
};
