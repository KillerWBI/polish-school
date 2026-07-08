const { Group, Lesson, IndividualCourse, IndividualLesson } = require('../models');
const { generateMeetLink } = require('./meet');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

// Валидация периода. Возвращает { from, to } как Date в UTC или бросает ошибку с .status
const parseRange = (fromStr, toStr) => {
  if (!fromStr || !toStr || !DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
    const err = new Error('from и to обязательны в формате YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  const from = new Date(`${fromStr}T00:00:00Z`);
  const to = new Date(`${toStr}T00:00:00Z`);
  if (isNaN(from) || isNaN(to)) {
    const err = new Error('Неверный формат даты');
    err.status = 400;
    throw err;
  }
  if (from > to) {
    const err = new Error('from должен быть <= to');
    err.status = 400;
    throw err;
  }
  const diffDays = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  if (diffDays > MAX_RANGE_DAYS) {
    const err = new Error(`Диапазон не может превышать ${MAX_RANGE_DAYS} дней`);
    err.status = 400;
    throw err;
  }
  return { from, to };
};

// Возвращает массив { date: 'YYYY-MM-DD', time: 'HH:mm' } для каждого слота
// schedule в [from, to] включительно. schedule: [{day: 0..6, time: 'HH:mm'}]
const expandSchedule = (schedule, fromStr, toStr) => {
  const { from, to } = parseRange(fromStr, toStr);
  if (!Array.isArray(schedule) || schedule.length === 0) return [];

  const slots = [];
  const cur = new Date(from);
  while (cur <= to) {
    const day = cur.getUTCDay();
    const dateStr = cur.toISOString().slice(0, 10);
    for (const s of schedule) {
      if (typeof s?.day === 'number' && s.day === day && s.time) {
        slots.push({ date: dateStr, time: s.time });
      }
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return slots;
};

const generateGroupLessons = async ({ groupId, from, to }) => {
  const group = await Group.findByPk(groupId);
  if (!group) {
    const err = new Error('Группа не найдена');
    err.status = 404;
    throw err;
  }
  const slots = expandSchedule(group.schedule || [], from, to);
  const created = [];
  for (const slot of slots) {
    const [lesson, isNew] = await Lesson.findOrCreate({
      where: { groupId, date: slot.date, time: slot.time },
      defaults: { groupId, date: slot.date, time: slot.time, lessonLink: generateMeetLink() },
    });
    if (isNew) created.push(lesson);
  }
  return created;
};

const generateIndividualLessons = async ({ courseId, from, to }) => {
  const course = await IndividualCourse.findByPk(courseId);
  if (!course) {
    const err = new Error('Курс не найден');
    err.status = 404;
    throw err;
  }
  const slots = expandSchedule(course.schedule || [], from, to);
  const created = [];
  for (const slot of slots) {
    const [lesson, isNew] = await IndividualLesson.findOrCreate({
      where: { individualCourseId: course.id, date: slot.date, time: slot.time },
      defaults: {
        individualCourseId: course.id,
        teacherId: course.teacherId,
        studentId: course.studentId,
        date: slot.date,
        time: slot.time,
        lessonLink: course.lessonLink || generateMeetLink(),
        pricePerLesson: course.pricePerLesson,
      },
    });
    if (isNew) created.push(lesson);
  }
  return created;
};

module.exports = { expandSchedule, generateGroupLessons, generateIndividualLessons };
