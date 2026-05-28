const { User, Group, GroupStudent, Lesson, IndividualCourse, IndividualLesson, Homework, HomeworkSubmission, Attendance, Payment } = require('../models');
const sequelize = require('../config/database');
const { QueryTypes, Op } = require('sequelize');
const { canViewStudentAnalytics } = require('../utils/analyticsAccess');

/* ═══════════════════════════════════════════════════════════════
   PERIOD HELPERS
   ═══════════════════════════════════════════════════════════════
   Период определяет формат бакета (день/неделя/месяц), сколько
   бакетов вернуть и какой PostgreSQL-формат даты использовать.
*/
const PERIOD_CONFIG = {
  day:   { count: 30, pgFormat: 'YYYY-MM-DD',  intervalSql: "30 days" },
  week:  { count: 12, pgFormat: 'IYYY-"W"IW',  intervalSql: "12 weeks" },
  month: { count: 6,  pgFormat: 'YYYY-MM',     intervalSql: "6 months" },
};

// JS-эквивалент PG to_char для построения пустых бакетов (см. fillBuckets)
const formatBucket = (date, period) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  if (period === 'day')   return `${y}-${m}-${d}`;
  if (period === 'month') return `${y}-${m}`;
  // ISO week — это нетривиальный расчёт. Чтобы не дублировать логику
  // PG-функции, при period=week мы НЕ заполняем пропуски заранее, а
  // полагаемся на то, что фронт корректно отрисует «провалы».
  // (Альтернатива — date-fns, но это лишняя зависимость ради одного места.)
  return null;
};

/**
 * Достроить пустые бакеты до нужного количества: если в SQL не было
 * данных за какой-то день/месяц, всё равно вернём бакет с нулями,
 * чтобы график не «прыгал».
 *
 * @param {Array<{bucket: string, ...}>} rows — что вернул SQL
 * @param {string} period — day / week / month
 * @param {Object} defaults — значения для пустых бакетов (например {paid:0, charged:0})
 */
const fillBuckets = (rows, period, defaults) => {
  const cfg = PERIOD_CONFIG[period];
  if (period === 'week') return rows; // week — пропускаем заполнение (см. formatBucket)

  const byBucket = new Map(rows.map(r => [r.bucket, r]));
  const out = [];
  const now = new Date();
  for (let i = cfg.count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (period === 'day')   d.setUTCDate(now.getUTCDate() - i);
    if (period === 'month') d.setUTCMonth(now.getUTCMonth() - i, 1);
    const key = formatBucket(d, period);
    out.push(byBucket.get(key) || { bucket: key, ...defaults });
  }
  return out;
};

/* ═══════════════════════════════════════════════════════════════
   GET /analytics/teacher/:userId
   ═══════════════════════════════════════════════════════════════
   Доступ: любой авторизованный (публичная витрина учителя).
   Если запрашиваемый user не teacher — 404, нет смысла отдавать пустую.
*/
const getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.params.userId;
    const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'month';
    const cfg = PERIOD_CONFIG[period];

    // Проверим, что юзер существует и это учитель
    const teacher = await User.findOne({
      where: { id: teacherId, role: 'teacher' },
      attributes: ['id'],
    });
    if (!teacher) return res.status(404).json({ error: 'Учитель не найден' });

    // ── 1. Revenue by period: 2 ряда (paid, charged) ─────────────
    // Идея SQL:
    //  - charged считаем по createdAt платежа (когда учитель начислил)
    //  - paid — по paidAt (когда деньги пришли)
    //  - студент учителя = (есть в группе учителя) ∨ (есть в его инд. курсе)
    //  - DISTINCT в подзапросе чтобы один и тот же студент не дублировался
    //    если он одновременно в группе и в инд.курсе
    //
    // FULL OUTER JOIN по bucket — чтобы получить все периоды где есть
    // хотя бы один из показателей. COALESCE() заменит NULL на 0.
    const revenueRows = await sequelize.query(`
      WITH teacher_students AS (
        SELECT DISTINCT gs."studentId" FROM "GroupStudents" gs
          JOIN "Groups" g ON g.id = gs."groupId"
          WHERE g."teacherId" = :teacherId
        UNION
        SELECT DISTINCT ic."studentId" FROM "IndividualCourses" ic
          WHERE ic."teacherId" = :teacherId
      ),
      charged AS (
        SELECT TO_CHAR(p."createdAt", :fmt) AS bucket, SUM(p.amount)::float AS total
        FROM "Payments" p
        WHERE p."studentId" IN (SELECT "studentId" FROM teacher_students)
          AND p."createdAt" >= NOW() - INTERVAL '${cfg.intervalSql}'
        GROUP BY 1
      ),
      paid AS (
        SELECT TO_CHAR(p."paidAt", :fmt) AS bucket, SUM(p.amount)::float AS total
        FROM "Payments" p
        WHERE p."studentId" IN (SELECT "studentId" FROM teacher_students)
          AND p.paid = true
          AND p."paidAt" >= NOW() - INTERVAL '${cfg.intervalSql}'
        GROUP BY 1
      )
      SELECT COALESCE(c.bucket, p.bucket) AS bucket,
             COALESCE(p.total, 0) AS paid,
             COALESCE(c.total, 0) AS charged
      FROM charged c FULL OUTER JOIN paid p ON c.bucket = p.bucket
      ORDER BY 1;
    `, { type: QueryTypes.SELECT, replacements: { teacherId, fmt: cfg.pgFormat } });

    const revenueByPeriod = fillBuckets(revenueRows, period, { paid: 0, charged: 0 });

    // ── 2. Активные студенты по месяцам (всегда 6 мес) ─────────────
    // «Активен в месяце» = есть Payment с month = M (учитель начислил →
    // значит студент в этом месяце реально занимался).
    // COUNT(DISTINCT studentId) защищает от двойного счёта если у студента
    // несколько payments в одном месяце.
    const studentsRows = await sequelize.query(`
      WITH teacher_students AS (
        SELECT DISTINCT gs."studentId" FROM "GroupStudents" gs
          JOIN "Groups" g ON g.id = gs."groupId"
          WHERE g."teacherId" = :teacherId
        UNION
        SELECT DISTINCT ic."studentId" FROM "IndividualCourses" ic
          WHERE ic."teacherId" = :teacherId
      )
      SELECT p.month AS bucket, COUNT(DISTINCT p."studentId")::int AS count
      FROM "Payments" p
      WHERE p."studentId" IN (SELECT "studentId" FROM teacher_students)
        AND p.month >= TO_CHAR(NOW() - INTERVAL '5 months', 'YYYY-MM')
      GROUP BY p.month
      ORDER BY p.month;
    `, { type: QueryTypes.SELECT, replacements: { teacherId } });

    const studentsByMonth = fillBuckets(studentsRows, 'month', { count: 0 });

    // ── 3. avgAttendance — общий % посещаемости по урокам учителя ──
    // present::int приводит boolean к 0/1, AVG возвращает долю true.
    // Объединяем посещения групповых и инд. уроков через UNION ALL.
    const [attendanceRow] = await sequelize.query(`
      WITH all_attendance AS (
        SELECT a.present::int AS p FROM "Attendances" a
          JOIN "Lessons" l ON l.id = a."lessonId"
          JOIN "Groups"  g ON g.id = l."groupId"
          WHERE g."teacherId" = :teacherId
        UNION ALL
        SELECT a.present::int AS p FROM "Attendances" a
          JOIN "IndividualLessons" il ON il.id = a."individualLessonId"
          WHERE il."teacherId" = :teacherId
      )
      SELECT COALESCE(ROUND(AVG(p) * 100)::int, 0) AS percent
      FROM all_attendance;
    `, { type: QueryTypes.SELECT, replacements: { teacherId } });

    // ── 4. Totals (для статов под именем учителя) ─────────────────
    // Считаем уникальных студентов через объединение групп и инд.курсов.
    const [totalsRow] = await sequelize.query(`
      WITH ts AS (
        SELECT DISTINCT gs."studentId" FROM "GroupStudents" gs
          JOIN "Groups" g ON g.id = gs."groupId"
          WHERE g."teacherId" = :teacherId
        UNION
        SELECT DISTINCT ic."studentId" FROM "IndividualCourses" ic
          WHERE ic."teacherId" = :teacherId
      )
      SELECT
        (SELECT COUNT(*) FROM ts)::int AS students,
        (SELECT COUNT(*) FROM "Groups" WHERE "teacherId" = :teacherId)::int AS groups,
        (
          (SELECT COUNT(*) FROM "Lessons" l JOIN "Groups" g ON g.id = l."groupId" WHERE g."teacherId" = :teacherId) +
          (SELECT COUNT(*) FROM "IndividualLessons" il WHERE il."teacherId" = :teacherId)
        )::int AS lessons;
    `, { type: QueryTypes.SELECT, replacements: { teacherId } });

    res.json({
      data: {
        revenueByPeriod,
        studentsByMonth,
        avgAttendance: attendanceRow?.percent ?? 0,
        totals: totalsRow ?? { students: 0, groups: 0, lessons: 0 },
      },
      meta: { period },
    });
  } catch (err) {
    console.error('getTeacherAnalytics:', err);
    res.status(500).json({ error: 'Ошибка получения аналитики учителя' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   GET /analytics/student/:id
   ═══════════════════════════════════════════════════════════════
   Доступ: сам студент ИЛИ его учитель (через canViewStudentAnalytics).
   Возвращает: attendance/месяц, hw completion %, последние оценки, totals.
*/
const getStudentAnalytics = async (req, res) => {
  try {
    const studentId = req.params.id;

    // Проверка доступа
    const allowed = await canViewStudentAnalytics(req.user.id, studentId);
    if (!allowed) return res.status(403).json({ error: 'Доступ запрещён' });

    // Студент существует и это student?
    const student = await User.findOne({
      where: { id: studentId, role: 'student' },
      attributes: ['id'],
    });
    if (!student) return res.status(404).json({ error: 'Студент не найден' });

    // ── 1. attendanceByMonth — % посещаемости по месяцам ─────────
    // Берём месяц из даты урока (Lesson.date / IndividualLesson.date),
    // а не из attendance.createdAt — даты выставления отметки могут
    // отличаться от даты урока (учитель отмечает задним числом).
    const attendanceRows = await sequelize.query(`
      WITH att AS (
        SELECT TO_CHAR(l.date, 'YYYY-MM') AS bucket, a.present::int AS p
          FROM "Attendances" a JOIN "Lessons" l ON l.id = a."lessonId"
          WHERE a."studentId" = :studentId
        UNION ALL
        SELECT TO_CHAR(il.date, 'YYYY-MM') AS bucket, a.present::int AS p
          FROM "Attendances" a JOIN "IndividualLessons" il ON il.id = a."individualLessonId"
          WHERE a."studentId" = :studentId
      )
      SELECT bucket, ROUND(AVG(p) * 100)::int AS percent
      FROM att
      WHERE bucket >= TO_CHAR(NOW() - INTERVAL '5 months', 'YYYY-MM')
      GROUP BY bucket
      ORDER BY bucket;
    `, { type: QueryTypes.SELECT, replacements: { studentId } });

    const attendanceByMonth = fillBuckets(attendanceRows, 'month', { percent: 0 });

    // ── 2. homeworkStats — только ДЗ с прошедшим дедлайном ───────
    // ДЗ доступно студенту, если:
    //  (a) ДЗ привязано к уроку (lessonId), и студент состоит в группе этого урока
    //  (b) или ДЗ привязано к инд.уроку (individualLessonId) этого студента
    // submitted = из этих ДЗ — сколько имеют HomeworkSubmission от него.
    const [hwRow] = await sequelize.query(`
      WITH due_hw AS (
        SELECT h.id FROM "Homeworks" h
          JOIN "Lessons" l         ON l.id = h."lessonId"
          JOIN "GroupStudents" gs  ON gs."groupId" = l."groupId"
          WHERE gs."studentId" = :studentId
            AND h.deadline IS NOT NULL AND h.deadline < NOW()
        UNION
        SELECT h.id FROM "Homeworks" h
          JOIN "IndividualLessons" il ON il.id = h."individualLessonId"
          WHERE il."studentId" = :studentId
            AND h.deadline IS NOT NULL AND h.deadline < NOW()
      )
      SELECT
        (SELECT COUNT(*) FROM due_hw)::int AS total,
        (SELECT COUNT(*) FROM "HomeworkSubmissions" hs
          WHERE hs."studentId" = :studentId
            AND hs."homeworkId" IN (SELECT id FROM due_hw))::int AS submitted;
    `, { type: QueryTypes.SELECT, replacements: { studentId } });

    const homeworkStats = {
      submitted: hwRow?.submitted ?? 0,
      total:     hwRow?.total     ?? 0,
      percent:   hwRow?.total > 0 ? Math.round((hwRow.submitted / hwRow.total) * 100) : 0,
    };

    // ── 3. grades — последние 10 оценённых сабмишнов ─────────────
    // updatedAt берём как «когда оценили» (контроллер ставит grade и updatedAt
    // обновляется автоматически). description обрезаем до 60 символов для UI.
    const gradesRows = await sequelize.query(`
      SELECT hs."updatedAt" AS at, hs.grade,
             SUBSTRING(h.description FROM 1 FOR 60) AS homework
      FROM "HomeworkSubmissions" hs
      JOIN "Homeworks" h ON h.id = hs."homeworkId"
      WHERE hs."studentId" = :studentId AND hs.grade IS NOT NULL
      ORDER BY hs."updatedAt" DESC
      LIMIT 10;
    `, { type: QueryTypes.SELECT, replacements: { studentId } });

    // ── 4. totals — общий % посещаемости + средняя оценка + урок-counts
    const [totalsRow] = await sequelize.query(`
      SELECT
        (SELECT COALESCE(ROUND(AVG(present::int) * 100)::int, 0)
           FROM "Attendances" WHERE "studentId" = :studentId) AS attendance,
        (SELECT COALESCE(ROUND(AVG(grade)::numeric, 1), 0)
           FROM "HomeworkSubmissions" WHERE "studentId" = :studentId AND grade IS NOT NULL) AS "gradesAvg",
        (SELECT COUNT(*)::int FROM "Attendances" WHERE "studentId" = :studentId AND present = true) AS "lessonsAttended";
    `, { type: QueryTypes.SELECT, replacements: { studentId } });

    res.json({
      data: {
        attendanceByMonth,
        homeworkStats,
        grades: gradesRows,
        totals: {
          attendance:      totalsRow?.attendance      ?? 0,
          gradesAvg:       Number(totalsRow?.gradesAvg ?? 0),
          lessonsAttended: totalsRow?.lessonsAttended ?? 0,
        },
      },
    });
  } catch (err) {
    console.error('getStudentAnalytics:', err);
    res.status(500).json({ error: 'Ошибка получения аналитики студента' });
  }
};

module.exports = { getTeacherAnalytics, getStudentAnalytics };
