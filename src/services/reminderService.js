const { Op, fn, col } = require('sequelize');
const {
  Lesson, IndividualLesson, Homework, HomeworkSubmission,
  Group, GroupStudent, Student, User, TrackCard, VocabItem,
} = require('../models');
const { sendLessonReminderEmail, sendHomeworkReminderEmail } = require('./email');
const { createNotification } = require('../utils/notify');

// Запускается раз в сутки (из index.js через node-cron).
// Находит все уроки и дедлайны ДЗ на ЗАВТРА и шлёт напоминания
// только ученикам с реальными аккаунтами (userId != null, emailVerified).
const runReminders = async () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10); // 'YYYY-MM-DD'

  console.log(`[reminders] запуск для даты ${tomorrow}`);

  await Promise.allSettled([
    remindGroupLessons(tomorrow),
    remindIndividualLessons(tomorrow),
    remindHomeworkDeadlines(tomorrow),
    remindDueReviews(),
  ]);

  console.log('[reminders] завершён');
};

// In-app напоминание о карточках/словах к повторению (по всем ученикам с due-элементами).
// Email не шлём — это самообучение, канал in-app (колокольчик), email — после домена.
const remindDueReviews = async () => {
  const now = new Date();
  const dueWhere = { status: { [Op.ne]: 'known' }, nextReviewAt: { [Op.lte]: now } };
  const countBy = async (Model) => {
    const rows = await Model.findAll({
      where: dueWhere,
      attributes: ['userId', [fn('COUNT', col('id')), 'n']],
      group: ['userId'], raw: true,
    }).catch(() => []);
    return rows;
  };
  const perUser = new Map();
  for (const Model of [TrackCard, VocabItem]) {
    for (const r of await countBy(Model)) {
      perUser.set(r.userId, (perUser.get(r.userId) || 0) + Number(r.n));
    }
  }
  for (const [userId, total] of perUser) {
    if (total <= 0) continue;
    createNotification(userId, {
      type: 'review_due',
      title: `${total} ${pluralCards(total)} на повторение`,
      body: 'Пройдите ежедневную сессию, чтобы закрепить материал.',
      link: '/study',
    }).catch(() => {});
  }
};

// «карточка/карточки/карточек» по числу
const pluralCards = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'карточка';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'карточки';
  return 'карточек';
};

// Групповые уроки — все студенты группы с реальными аккаунтами
const remindGroupLessons = async (targetDate) => {
  const lessons = await Lesson.findAll({
    where: { date: targetDate },
    include: [{ model: Group, attributes: ['id', 'name', 'teacherId'] }],
    attributes: ['id', 'date', 'time', 'topic', 'lessonLink', 'groupId'],
  });
  if (!lessons.length) return;

  const teacherIds = [...new Set(lessons.map(l => l.Group?.teacherId).filter(Boolean))];
  const teachers = await User.findAll({ where: { id: teacherIds }, attributes: ['id', 'name'] });
  const teacherMap = new Map(teachers.map(t => [t.id, t.name]));

  for (const lesson of lessons) {
    const teacherName = teacherMap.get(lesson.Group?.teacherId) || 'преподаватель';
    // Ученики группы с реальными аккаунтами
    const members = await GroupStudent.findAll({
      where: { groupId: lesson.groupId },
      include: [{
        model: Student, as: 'student',
        where: { userId: { [Op.ne]: null } },
        include: [{ model: User, as: 'account', where: { emailVerified: true }, attributes: ['email', 'name'] }],
      }],
    }).catch(() => []);

    for (const m of members) {
      const account = m.student?.account;
      if (!account?.email) continue;
      sendLessonReminderEmail(account.email, account.name, {
        date: lesson.date, time: lesson.time,
        topic: lesson.topic, lessonLink: lesson.lessonLink,
        teacherName,
      }).catch(e => console.error(`[reminders] lesson email error: ${e.message}`));
    }
  }
};

// Индивидуальные уроки — один студент
const remindIndividualLessons = async (targetDate) => {
  const lessons = await IndividualLesson.findAll({
    where: { date: targetDate },
    include: [
      { model: Student, as: 'student', where: { userId: { [Op.ne]: null } },
        include: [{ model: User, as: 'account', where: { emailVerified: true }, attributes: ['email', 'name'] }] },
      { model: User, as: 'teacher', attributes: ['name'] },
    ],
    attributes: ['id', 'date', 'time', 'topic', 'lessonLink'],
  }).catch(() => []);

  for (const lesson of lessons) {
    const account = lesson.student?.account;
    if (!account?.email) continue;
    sendLessonReminderEmail(account.email, account.name, {
      date: lesson.date, time: lesson.time,
      topic: lesson.topic, lessonLink: lesson.lessonLink,
      teacherName: lesson.teacher?.name || 'преподаватель',
    }).catch(e => console.error(`[reminders] ind lesson email error: ${e.message}`));
  }
};

// Дедлайны ДЗ — студентам, которые ещё не сдали
const remindHomeworkDeadlines = async (targetDate) => {
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd   = `${targetDate}T23:59:59.999Z`;

  const hws = await Homework.findAll({
    where: { deadline: { [Op.between]: [dayStart, dayEnd] } },
    include: [
      { model: Lesson, required: false, include: [{ model: Group, attributes: ['id', 'name'] }] },
      { model: HomeworkSubmission, as: 'submissions', attributes: ['studentId'], required: false },
    ],
    attributes: ['id', 'description', 'deadline', 'lessonId', 'individualLessonId'],
  }).catch(() => []);

  for (const hw of hws) {
    const submittedStudentIds = new Set((hw.submissions || []).map(s => s.studentId));
    const deadlineStr = hw.deadline ? new Date(hw.deadline).toLocaleDateString('ru-RU') : '';
    const lessonTitle = hw.Lesson?.Group?.name || null;

    let studentsToNotify = [];

    if (hw.lessonId) {
      // Групповое ДЗ — все студенты группы
      const groupId = hw.Lesson?.groupId;
      if (!groupId) continue;
      studentsToNotify = await GroupStudent.findAll({
        where: { groupId, studentId: { [Op.notIn]: [...submittedStudentIds] } },
        include: [{
          model: Student, as: 'student',
          where: { userId: { [Op.ne]: null } },
          include: [{ model: User, as: 'account', where: { emailVerified: true }, attributes: ['email', 'name'] }],
        }],
      }).catch(() => []);
    } else if (hw.individualLessonId) {
      // Индивидуальное ДЩ — один студент
      const il = await IndividualLesson.findByPk(hw.individualLessonId, {
        include: [{
          model: Student, as: 'student',
          where: { userId: { [Op.ne]: null } },
          include: [{ model: User, as: 'account', where: { emailVerified: true }, attributes: ['email', 'name'] }],
        }],
      }).catch(() => null);
      if (il?.student && !submittedStudentIds.has(il.student.id)) {
        studentsToNotify = [{ student: il.student }];
      }
    }

    for (const m of studentsToNotify) {
      const account = m.student?.account;
      if (!account?.email) continue;
      sendHomeworkReminderEmail(account.email, account.name, {
        description: hw.description, deadline: deadlineStr, lessonTitle,
      }).catch(e => console.error(`[reminders] hw email error: ${e.message}`));
    }
  }
};

module.exports = { runReminders };
