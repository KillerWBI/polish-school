'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Переносим существующие связи учитель↔студент в TeacherStudent.
  // Источник: членство в группах (GroupStudents → Groups.teacherId) + индивидуальные курсы.
  // UNION дедуплицирует источник; ON CONFLICT — на случай уже принятых через заявку.
  // gen_random_uuid() — встроена в Postgres 13+ (id не имеет DB-default).
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO "TeacherStudents" ("id", "teacherId", "studentId", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), src."teacherId", src."studentId", NOW(), NOW()
      FROM (
        SELECT g."teacherId" AS "teacherId", gs."studentId" AS "studentId"
        FROM "GroupStudents" gs
        JOIN "Groups" g ON g."id" = gs."groupId"
        UNION
        SELECT ic."teacherId", ic."studentId"
        FROM "IndividualCourses" ic
      ) src
      ON CONFLICT ("teacherId", "studentId") DO NOTHING;
    `);
  },

  // Backfill данных в общем случае необратим: после него нельзя отличить
  // перенесённые строки от созданных через accept заявки. down — осознанный no-op.
  async down() {
    // no-op: см. комментарий выше
  },
};
