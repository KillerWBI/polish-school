'use strict';

/** @type {import('sequelize-cli').Migration} */
// C1 фаза 2: на каждую уникальную пару (teacherId, userId) из ВСЕХ 6 источников —
// одна строка Student (name = снимок User.name, contact = NULL). userId здесь всегда
// заполнен (источник — существующие ученики-User). ON CONFLICT — защита от повторного прогона.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO "Students" ("id", "teacherId", "userId", "name", "contact", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), p."teacherId", p."userId", u."name", NULL, NOW(), NOW()
      FROM (
        SELECT DISTINCT "teacherId", "userId" FROM (
          SELECT g."teacherId", gs."studentId" AS "userId" FROM "GroupStudents" gs JOIN "Groups" g ON g.id = gs."groupId"
          UNION SELECT "teacherId", "studentId" FROM "IndividualCourses"
          UNION SELECT "teacherId", "studentId" FROM "IndividualLessons"
          UNION SELECT "teacherId", "studentId" FROM "PaymentRecords"
          UNION SELECT g."teacherId", a."studentId" FROM "Attendances" a JOIN "Lessons" l ON l.id = a."lessonId" JOIN "Groups" g ON g.id = l."groupId" WHERE a."lessonId" IS NOT NULL
          UNION SELECT il."teacherId", a."studentId" FROM "Attendances" a JOIN "IndividualLessons" il ON il.id = a."individualLessonId" WHERE a."individualLessonId" IS NOT NULL
          UNION SELECT g."teacherId", hs."studentId" FROM "HomeworkSubmissions" hs JOIN "Homeworks" h ON h.id = hs."homeworkId" JOIN "Lessons" l ON l.id = h."lessonId" JOIN "Groups" g ON g.id = l."groupId" WHERE h."lessonId" IS NOT NULL
          UNION SELECT il."teacherId", hs."studentId" FROM "HomeworkSubmissions" hs JOIN "Homeworks" h ON h.id = hs."homeworkId" JOIN "IndividualLessons" il ON il.id = h."individualLessonId" WHERE h."individualLessonId" IS NOT NULL
        ) pairs
      ) p
      JOIN "Users" u ON u.id = p."userId"
      ON CONFLICT DO NOTHING
    `);
  },

  // Backfill необратим (нельзя отличить backfill-строки от созданных вручную). down = no-op.
  async down() {},
};
