'use strict';

/** @type {import('sequelize-cli').Migration}
 *
 * Восстанавливает unique-уникальность в едином виде — как unique-ИНДЕКСЫ
 * (а не констрейнты). Причина: констрейнты из 20260521000001 затирались
 * `sequelize.sync({ alter: true })` в dev, т.к. их не было в моделях. Теперь
 * индексы объявлены и в моделях (sync их сохраняет), и тут (прод/новые БД).
 *
 * Идемпотентна: DROP CONSTRAINT IF EXISTS снимает старый констрейнт (на проде он
 * есть, в dev уже снесён sync'ом), CREATE UNIQUE INDEX IF NOT EXISTS не падает,
 * если индекс уже создан моделью через sync.
 */
const TABLES = [
  { table: 'Lessons',             oldConstraint: 'lessons_group_date_time_unique',             index: 'lessons_group_date_time_uidx',             cols: '("groupId", "date", "time")' },
  { table: 'IndividualLessons',   oldConstraint: 'individual_lessons_course_date_time_unique',  index: 'individual_lessons_course_date_time_uidx',  cols: '("individualCourseId", "date", "time")' },
  { table: 'HomeworkSubmissions', oldConstraint: 'homework_submissions_hw_student_unique',      index: 'homework_submissions_hw_student_uidx',      cols: '("homeworkId", "studentId")' },
];

module.exports = {
  async up(queryInterface) {
    for (const { table, oldConstraint, index, cols } of TABLES) {
      await queryInterface.sequelize.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${oldConstraint}"`);
      await queryInterface.sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${index}" ON "${table}" ${cols}`);
    }
  },

  async down(queryInterface) {
    for (const { index } of TABLES) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${index}"`);
    }
  },
};
