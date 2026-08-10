const { Attendance } = require('../models');

// ── Авто-подтверждение: если студент не ответил за 3 дня — засчитываем как учитель ──
// Раньше вызывалось из GET /attendance и GET /attendance/pending, то есть UPDATE по
// всей таблице шёл при каждом открытии журнала. Теперь — раз в сутки по крону.
const autoConfirmExpired = async () => {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [, groupRes] = await Attendance.sequelize.query(`
    UPDATE "Attendances" a
    SET "studentMarked" = "teacherMarked",
        "status"        = 'confirmed',
        "present"       = "teacherMarked",
        "updatedAt"     = NOW()
    FROM "Lessons" l
    WHERE a."lessonId" = l.id
      AND a."status" = 'pending_student'
      AND l."date" < :cutoff
  `, { replacements: { cutoff } });

  const [, indRes] = await Attendance.sequelize.query(`
    UPDATE "Attendances" a
    SET "studentMarked" = "teacherMarked",
        "status"        = 'confirmed',
        "present"       = "teacherMarked",
        "updatedAt"     = NOW()
    FROM "IndividualLessons" il
    WHERE a."individualLessonId" = il.id
      AND a."status" = 'pending_student'
      AND il."date" < :cutoff
  `, { replacements: { cutoff } });

  return (groupRes?.rowCount || 0) + (indRes?.rowCount || 0);
};

module.exports = { autoConfirmExpired };
