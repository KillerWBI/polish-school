const {
  Group, GroupStudent, Lesson, IndividualLesson,
  Homework, HomeworkSubmission, Attendance, PaymentRecord, User, Student,
} = require('../models');
const { Op } = require('sequelize');
const { getTeacherDebtTotal, getStudentDebtTotal } = require('./payment.controller');
const { getStudentIdsForUser } = require('../utils/students');

/* ════════════════════════════════════════════════════════════════════════
   УЧИТЕЛЬ
   Запросы параллелизированы по реальным зависимостям (не по порядку в коде):
   1) groups — нужен для groupIds, дальше почти всё от него зависит
   2) большой Promise.all — всё, что зависит только от groupIds/teacherId
   3) ДЗ-без-проверки и посещаемость — зависят от id'шников из шага 2, но не друг от друга
   Долг (totalDebt) не зависит ни от чего из этого — запускается сразу первым.
   ════════════════════════════════════════════════════════════════════════ */
const buildTeacherDashboard = async (teacherId) => {
  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const [year, mon]  = currentMonth.split('-').map(Number);
  const monthStart   = `${currentMonth}-01`;
  const monthEnd     = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);

  const totalDebtPromise = getTeacherDebtTotal(teacherId);

  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id', 'name'] });
  const groupIds = groups.map(g => g.id);

  const [
    allLessons, allIndLessons,
    groupLessonsToday, indLessonsToday,
    monthLessons, monthIndLessons,
    upcomingGroup, upcomingInd,
  ] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId }, attributes: ['id'] }),
    groupIds.length
      ? Lesson.count({ where: { groupId: { [Op.in]: groupIds }, date: today } })
      : Promise.resolve(0),
    IndividualLesson.count({ where: { teacherId, date: today } }),
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] }),
    groupIds.length
      ? Lesson.findAll({
          where: { groupId: { [Op.in]: groupIds }, date: { [Op.gte]: today } },
          include: [{ model: Group, attributes: ['id', 'name'] }],
          order: [['date', 'ASC'], ['time', 'ASC']],
          limit: 5,
          attributes: ['id', 'date', 'time', 'topic'],
        })
      : Promise.resolve([]),
    IndividualLesson.findAll({
      where: { teacherId, date: { [Op.gte]: today } },
      include: [{ model: Student, as: 'student', attributes: ['id', 'name'] }],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: 5,
      attributes: ['id', 'date', 'time'],
    }),
  ]);

  const lessonsToday      = groupLessonsToday + indLessonsToday;
  const allLessonIds      = allLessons.map(l => l.id);
  const allIndLessonIds   = allIndLessons.map(l => l.id);
  const monthLessonIds    = monthLessons.map(l => l.id);
  const monthIndLessonIds = monthIndLessons.map(l => l.id);

  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });

  const attOr = [];
  if (monthLessonIds.length)    attOr.push({ lessonId:           { [Op.in]: monthLessonIds } });
  if (monthIndLessonIds.length) attOr.push({ individualLessonId: { [Op.in]: monthIndLessonIds } });

  const [{ ungradedCount, ungradedList }, attendancePercent] = await Promise.all([
    // 2. ДЗ без проверки
    (async () => {
      if (!hwOr.length) return { ungradedCount: 0, ungradedList: [] };
      const hws = await Homework.findAll({ where: { [Op.or]: hwOr }, attributes: ['id'] });
      const hwIds = hws.map(h => h.id);
      if (!hwIds.length) return { ungradedCount: 0, ungradedList: [] };
      const [ungradedCount, ungradedList] = await Promise.all([
        HomeworkSubmission.count({ where: { homeworkId: { [Op.in]: hwIds }, status: 'pending' } }),
        HomeworkSubmission.findAll({
          where: { homeworkId: { [Op.in]: hwIds }, status: 'pending' },
          include: [
            { model: Student,  as: 'student', attributes: ['id', 'name'] },
            { model: Homework, attributes: ['id', 'description'] },
          ],
          order: [['createdAt', 'DESC']],
          limit: 5,
          subQuery: false,
        }),
      ]);
      return { ungradedCount, ungradedList };
    })(),
    // 4. Посещаемость месяца
    (async () => {
      if (!attOr.length) return null;
      const [total, present] = await Promise.all([
        Attendance.count({ where: { [Op.or]: attOr } }),
        Attendance.count({ where: { [Op.or]: attOr, present: true } }),
      ]);
      return total > 0 ? Math.round((present / total) * 100) : null;
    })(),
  ]);

  const totalDebt = await totalDebtPromise;

  // 5. Ближайшие уроки
  const upcomingLessons = [
    ...upcomingGroup.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: l.topic,
      type: 'group', label: l.Group?.name,
    })),
    ...upcomingInd.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: null,
      type: 'individual', label: l.student?.name,
    })),
  ]
    .sort((a, b) => (`${a.date}T${a.time}` < `${b.date}T${b.time}` ? -1 : 1))
    .slice(0, 5);

  return {
    role: 'teacher',
    kpi: {
      lessonsToday,
      ungradedSubmissions: ungradedCount,
      totalDebt: Math.round(totalDebt * 100) / 100,
      attendancePercent,
    },
    upcomingLessons,
    ungradedList,
  };
};

/* ════════════════════════════════════════════════════════════════════════
   СТУДЕНТ (та же логика распараллеливания, что и у учителя)
   ════════════════════════════════════════════════════════════════════════ */
const buildStudentDashboard = async (userId) => {
  // Пользователь = несколько Student-записей (по одной на учителя). studentId — массив их id;
  // поэтому все where { studentId } ниже становятся IN-фильтрами по этим записям.
  const studentId = await getStudentIdsForUser(userId);
  const today        = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const [year, mon]  = currentMonth.split('-').map(Number);
  const monthStart   = `${currentMonth}-01`;
  const monthEnd     = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
  const next7Days    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Долг — по каждой Student-записи независимо, ни от чего ниже не зависит
  const myDebtPromise = Promise.all(studentId.map(sid => getStudentDebtTotal(sid)))
    .then(arr => arr.reduce((a, b) => a + b, 0));

  // Группы студента
  const memberships = await GroupStudent.findAll({ where: { studentId }, attributes: ['groupId'] });
  const groupIds = memberships.map(m => m.groupId);

  const [
    allLessons, allIndLessons,
    weekGroupCount, weekIndCount,
    monthLessons, monthIndLessons,
    upcomingGroup, upcomingInd,
  ] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { studentId }, attributes: ['id'] }),
    groupIds.length
      ? Lesson.count({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [today, next7Days] } } })
      : Promise.resolve(0),
    IndividualLesson.count({ where: { studentId, date: { [Op.between]: [today, next7Days] } } }),
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds }, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { studentId, date: { [Op.between]: [monthStart, monthEnd] } }, attributes: ['id'] }),
    groupIds.length
      ? Lesson.findAll({
          where: { groupId: { [Op.in]: groupIds }, date: { [Op.gte]: today } },
          include: [{ model: Group, attributes: ['id', 'name', 'lessonLink'] }],
          order: [['date', 'ASC'], ['time', 'ASC']],
          limit: 5,
          attributes: ['id', 'date', 'time', 'topic', 'lessonLink'],
        })
      : Promise.resolve([]),
    IndividualLesson.findAll({
      where: { studentId, date: { [Op.gte]: today } },
      include: [{ model: User, as: 'teacher', attributes: ['id', 'name'] }],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: 5,
      attributes: ['id', 'date', 'time'],
    }),
  ]);

  const lessonsThisWeek    = weekGroupCount + weekIndCount;
  const allLessonIds       = allLessons.map(l => l.id);
  const allIndLessonIds    = allIndLessons.map(l => l.id);
  const monthLessonIds     = monthLessons.map(l => l.id);
  const monthIndLessonIds  = monthIndLessons.map(l => l.id);

  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });

  const attOr = [];
  if (monthLessonIds.length)    attOr.push({ lessonId:           { [Op.in]: monthLessonIds } });
  if (monthIndLessonIds.length) attOr.push({ individualLessonId: { [Op.in]: monthIndLessonIds } });

  const [{ pendingHwCount, pendingHwList }, attendancePercent] = await Promise.all([
    // 2. ДЗ к сдаче (мои + не сданные)
    (async () => {
      if (!hwOr.length) return { pendingHwCount: 0, pendingHwList: [] };
      const hws = await Homework.findAll({
        where: { [Op.or]: hwOr },
        attributes: ['id', 'description', 'deadline', 'lessonId', 'individualLessonId'],
        order: [['deadline', 'ASC']],
      });
      if (!hws.length) return { pendingHwCount: 0, pendingHwList: [] };
      const hwIds = hws.map(h => h.id);
      const mySubs = await HomeworkSubmission.findAll({
        where: { homeworkId: { [Op.in]: hwIds }, studentId },
        attributes: ['homeworkId'],
      });
      const submittedHwIds = new Set(mySubs.map(s => s.homeworkId));
      const pending = hws.filter(h => !submittedHwIds.has(h.id));
      return {
        pendingHwCount: pending.length,
        pendingHwList: pending.slice(0, 5).map(h => ({
          id: h.id, description: h.description, deadline: h.deadline,
          type: h.lessonId ? 'group' : 'individual',
        })),
      };
    })(),
    // 3. Посещаемость месяца (моя)
    (async () => {
      if (!attOr.length) return null;
      const [total, present] = await Promise.all([
        Attendance.count({ where: { [Op.or]: attOr, studentId } }),
        Attendance.count({ where: { [Op.or]: attOr, studentId, present: true } }),
      ]);
      return total > 0 ? Math.round((present / total) * 100) : null;
    })(),
  ]);

  const myDebt = await myDebtPromise;

  // 5. Ближайшие уроки
  const upcomingLessons = [
    ...upcomingGroup.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: l.topic,
      type: 'group', label: l.Group?.name,
      lessonLink: l.lessonLink || l.Group?.lessonLink,
    })),
    ...upcomingInd.map(l => ({
      id: l.id, date: l.date, time: l.time, topic: null,
      type: 'individual', label: l.teacher?.name,
      lessonLink: null,
    })),
  ]
    .sort((a, b) => (`${a.date}T${a.time}` < `${b.date}T${b.time}` ? -1 : 1))
    .slice(0, 5);

  return {
    role: 'student',
    kpi: {
      lessonsThisWeek,
      pendingHomework: pendingHwCount,
      attendancePercent,
      myDebt: Math.round(myDebt * 100) / 100,
    },
    upcomingLessons,
    pendingHomework: pendingHwList,
  };
};

/* ════════════════════════════════════════════════════════════════════════
   Главный handler — switch по роли
   ════════════════════════════════════════════════════════════════════════ */
const getDashboard = async (req, res) => {
  try {
    const data = req.user.role === 'teacher'
      ? await buildTeacherDashboard(req.user.id)
      : await buildStudentDashboard(req.user.id);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки дашборда' });
  }
};

/* ════════════════════════════════════════════════════════════════════════
   ЛЕНТА АКТИВНОСТИ — отдельно для каждой роли
   ════════════════════════════════════════════════════════════════════════ */
const buildTeacherActivity = async (teacherId) => {
  // Оплаты не зависят от групп/уроков — запускаем сразу, параллельно
  const paymentsPromise = PaymentRecord.findAll({
    where: { teacherId },
    include: [{ model: Student, as: 'student', attributes: ['id', 'name'] }],
    order: [['paidAt', 'DESC']],
    limit: 10,
    attributes: ['id', 'amount', 'paidAt'],
  });

  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id'] });
  const groupIds = groups.map(g => g.id);

  const [allLessons, allIndLessons] = await Promise.all([
    groupIds.length
      ? Lesson.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['id'] })
      : Promise.resolve([]),
    IndividualLesson.findAll({ where: { teacherId }, attributes: ['id'] }),
  ]);
  const allLessonIds    = allLessons.map(l => l.id);
  const allIndLessonIds = allIndLessons.map(l => l.id);

  let submissions = [];
  const hwOr = [];
  if (allLessonIds.length)    hwOr.push({ lessonId:           { [Op.in]: allLessonIds } });
  if (allIndLessonIds.length) hwOr.push({ individualLessonId: { [Op.in]: allIndLessonIds } });
  if (hwOr.length) {
    const hws = await Homework.findAll({ where: { [Op.or]: hwOr }, attributes: ['id', 'description'] });
    const hwIds = hws.map(h => h.id);
    if (hwIds.length) {
      submissions = await HomeworkSubmission.findAll({
        where: { homeworkId: { [Op.in]: hwIds } },
        include: [
          { model: Student,  as: 'student', attributes: ['id', 'name'] },
          { model: Homework, attributes: ['id', 'description'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: 10,
        attributes: ['id', 'status', 'createdAt'],
      });
    }
  }

  const payments = await paymentsPromise;

  return [
    ...submissions.map(s => ({
      id:   `sub-${s.id}`,
      type: 'submission',
      text: `${s.student?.name ?? '?'} сдал(а) ДЗ «${s.Homework?.description?.slice(0, 40) ?? ''}»`,
      at:   s.createdAt,
      extra: s.status === 'pending' ? 'Ждёт проверки' : 'Проверено',
    })),
    ...payments.map(p => ({
      id:   `pay-${p.id}`,
      type: 'payment',
      text: `${p.student?.name ?? '?'} оплатил(а) ${p.amount} zł`,
      at:   p.paidAt,
      extra: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);
};

const buildStudentActivity = async (userId) => {
  const studentId = await getStudentIdsForUser(userId); // массив Student.id пользователя → where IN

  const [submissions, payments] = await Promise.all([
    HomeworkSubmission.findAll({
      where: { studentId },
      include: [{ model: Homework, attributes: ['id', 'description'] }],
      order: [['updatedAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'status', 'grade', 'createdAt', 'updatedAt'],
    }),
    PaymentRecord.findAll({
      where: { studentId },
      order: [['paidAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'amount', 'paidAt'],
    }),
  ]);

  return [
    ...submissions.map(s => {
      const isGraded = s.status === 'graded';
      const text = isGraded
        ? `Оценка ${s.grade}/100 за «${s.Homework?.description?.slice(0, 40) ?? ''}»`
        : `Сдал(а) «${s.Homework?.description?.slice(0, 40) ?? ''}» — ждёт проверки`;
      return {
        id:   `sub-${s.id}`,
        type: isGraded ? 'grade' : 'submission',
        text,
        at:   s.updatedAt,
        extra: null,
      };
    }),
    ...payments.map(p => ({
      id:   `pay-${p.id}`,
      type: 'payment',
      text: `Оплачено ${p.amount} zł`,
      at:   p.paidAt,
      extra: null,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 15);
};

const getActivity = async (req, res) => {
  try {
    const events = req.user.role === 'teacher'
      ? await buildTeacherActivity(req.user.id)
      : await buildStudentActivity(req.user.id);
    res.json({ data: events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки активности' });
  }
};

module.exports = { getDashboard, getActivity };
