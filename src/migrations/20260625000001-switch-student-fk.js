'use strict';

/** @type {import('sequelize-cli').Migration} */
// C1 фаза 4: переключить studentId в 6 таблицах со значения User.id на Student.id
// и пересадить FK-констрейнт с Users на Students. Всё в одной транзакции (атомарно).
// Порядок на таблицу: DROP старый FK (→Users) → UPDATE значений → ADD новый FK (→Students).
// teacherId для маппинга берётся из контекста каждой таблицы (КРИТИЧНО: иначе ученику
// у двух учителей присвоится чужой Student.id).
module.exports = {
  async up(queryInterface) {
    const sql = queryInterface.sequelize;
    await sql.transaction(async (t) => {
      const run = (q) => sql.query(q, { transaction: t });

      // 0. Очистка сирот: сдачи на удалённые ДЗ (нарушают свой же FK, не мапятся на Student —
      //    нет ДЗ → нет учителя). В БД таких сдач быть не должно; submission к несуществующему ДЗ бесполезна.
      await run('DELETE FROM "HomeworkSubmissions" hs WHERE NOT EXISTS (SELECT 1 FROM "Homeworks" h WHERE h.id = hs."homeworkId")');

      // 1. PaymentRecords (teacherId — прямое поле)
      await run('ALTER TABLE "PaymentRecords" DROP CONSTRAINT "PaymentRecords_studentId_fkey"');
      await run(`UPDATE "PaymentRecords" pr SET "studentId" = s.id
                 FROM "Students" s WHERE s."userId" = pr."studentId" AND s."teacherId" = pr."teacherId"`);
      await run('ALTER TABLE "PaymentRecords" ADD CONSTRAINT "PaymentRecords_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');

      // 2. HomeworkSubmissions (teacherId через Homework→Lesson→Group ИЛИ Homework→IndividualLesson)
      await run('ALTER TABLE "HomeworkSubmissions" DROP CONSTRAINT "HomeworkSubmissions_studentId_fkey"');
      await run(`UPDATE "HomeworkSubmissions" hs SET "studentId" = s.id
                 FROM "Students" s, "Homeworks" h
                 WHERE h.id = hs."homeworkId" AND s."userId" = hs."studentId"
                   AND s."teacherId" = COALESCE(
                     (SELECT g."teacherId" FROM "Lessons" l JOIN "Groups" g ON g.id = l."groupId" WHERE l.id = h."lessonId"),
                     (SELECT il."teacherId" FROM "IndividualLessons" il WHERE il.id = h."individualLessonId")
                   )`);
      await run('ALTER TABLE "HomeworkSubmissions" ADD CONSTRAINT "HomeworkSubmissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');

      // 3. Attendances (teacherId через Lesson→Group ИЛИ IndividualLesson)
      await run('ALTER TABLE "Attendances" DROP CONSTRAINT "Attendances_studentId_fkey"');
      await run(`UPDATE "Attendances" a SET "studentId" = s.id
                 FROM "Students" s
                 WHERE s."userId" = a."studentId"
                   AND s."teacherId" = COALESCE(
                     (SELECT g."teacherId" FROM "Lessons" l JOIN "Groups" g ON g.id = l."groupId" WHERE l.id = a."lessonId"),
                     (SELECT il."teacherId" FROM "IndividualLessons" il WHERE il.id = a."individualLessonId")
                   )`);
      await run('ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');

      // 4. IndividualLessons (teacherId — прямое поле)
      await run('ALTER TABLE "IndividualLessons" DROP CONSTRAINT "IndividualLessons_studentId_fkey"');
      await run(`UPDATE "IndividualLessons" il SET "studentId" = s.id
                 FROM "Students" s WHERE s."userId" = il."studentId" AND s."teacherId" = il."teacherId"`);
      await run('ALTER TABLE "IndividualLessons" ADD CONSTRAINT "IndividualLessons_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');

      // 5. IndividualCourses (teacherId — прямое поле)
      await run('ALTER TABLE "IndividualCourses" DROP CONSTRAINT "IndividualCourses_studentId_fkey"');
      await run(`UPDATE "IndividualCourses" ic SET "studentId" = s.id
                 FROM "Students" s WHERE s."userId" = ic."studentId" AND s."teacherId" = ic."teacherId"`);
      await run('ALTER TABLE "IndividualCourses" ADD CONSTRAINT "IndividualCourses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');

      // 6. GroupStudents (teacherId через Group)
      await run('ALTER TABLE "GroupStudents" DROP CONSTRAINT "GroupStudents_studentId_fkey"');
      await run(`UPDATE "GroupStudents" gs SET "studentId" = s.id
                 FROM "Students" s, "Groups" g
                 WHERE g.id = gs."groupId" AND s."userId" = gs."studentId" AND s."teacherId" = g."teacherId"`);
      await run('ALTER TABLE "GroupStudents" ADD CONSTRAINT "GroupStudents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Students"("id") ON DELETE CASCADE');
    });
  },

  // Обратный маппing: studentId (Student.id) → назад в Students.userId, FK обратно на Users.
  // Работает, пока Students-строки целы и userId не null (в C1 заглушек ещё нет).
  async down(queryInterface) {
    const sql = queryInterface.sequelize;
    await sql.transaction(async (t) => {
      const run = (q) => sql.query(q, { transaction: t });
      for (const T of ['PaymentRecords', 'HomeworkSubmissions', 'Attendances', 'IndividualLessons', 'IndividualCourses', 'GroupStudents']) {
        await run(`ALTER TABLE "${T}" DROP CONSTRAINT "${T}_studentId_fkey"`);
        await run(`UPDATE "${T}" tt SET "studentId" = s."userId" FROM "Students" s WHERE s.id = tt."studentId"`);
        await run(`ALTER TABLE "${T}" ADD CONSTRAINT "${T}_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Users"("id") ON DELETE CASCADE`);
      }
    });
  },
};
