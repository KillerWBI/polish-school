/**
 * Демо-наполнение: учитель с множеством групп, реальных учеников и заглушек,
 * уроками (прошлые/будущие), посещаемостью всех статусов, ДЗ, оплатами/долгами,
 * индивидуальными курсами и разовыми уроками.
 *
 * Запуск:  node seed-demo.js
 * Идемпотентно: перед наполнением удаляет прежние демо-данные (домен @linguaflow.demo).
 *
 * Логин учителя после запуска:  demo.teacher@linguaflow.demo / Demo1234!
 */
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  User, Student, TeacherStudent, Group, GroupStudent, Lesson,
  Attendance, PaymentRecord, Homework, HomeworkSubmission,
  IndividualCourse, IndividualLesson,
} = require('./src/models');

const TODAY = '2026-07-03';
const RANGE_FROM = '2026-05-01';
const RANGE_TO = '2026-08-31';
const PASS = bcrypt.hashSync('Demo1234!', 10);

// weekday(0..6) слоты из schedule → список {date,time} в диапазоне
function lessonSlots(schedule, from, to) {
  const out = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    for (const s of schedule) if (s.day === wd) out.push({ date: d.toISOString().slice(0, 10), time: s.time });
  }
  return out;
}
const isPast = (date) => date < TODAY;

async function cleanup() {
  const teacher = await User.findOne({ where: { email: 'demo.teacher@linguaflow.demo' } });
  if (teacher) {
    const groups = await Group.findAll({ where: { teacherId: teacher.id }, attributes: ['id'], raw: true });
    const groupIds = groups.map(g => g.id);
    const lessons = groupIds.length ? await Lesson.findAll({ where: { groupId: groupIds }, attributes: ['id'], raw: true }) : [];
    const lessonIds = lessons.map(l => l.id);
    const indLessons = await IndividualLesson.findAll({ where: { teacherId: teacher.id }, attributes: ['id'], raw: true });
    const indLessonIds = indLessons.map(l => l.id);
    const students = await Student.findAll({ where: { teacherId: teacher.id }, attributes: ['id'], raw: true });
    const studentIds = students.map(s => s.id);

    const hwWhere = [];
    if (lessonIds.length) hwWhere.push({ lessonId: lessonIds });
    if (indLessonIds.length) hwWhere.push({ individualLessonId: indLessonIds });
    const hws = hwWhere.length ? await Homework.findAll({ where: { [Op.or]: hwWhere }, attributes: ['id'], raw: true }) : [];
    const hwIds = hws.map(h => h.id);

    if (hwIds.length || studentIds.length) {
      const subWhere = [];
      if (hwIds.length) subWhere.push({ homeworkId: hwIds });
      if (studentIds.length) subWhere.push({ studentId: studentIds });
      await HomeworkSubmission.destroy({ where: { [Op.or]: subWhere } });
    }
    if (hwIds.length) await Homework.destroy({ where: { id: hwIds } });

    const attWhere = [];
    if (lessonIds.length) attWhere.push({ lessonId: lessonIds });
    if (indLessonIds.length) attWhere.push({ individualLessonId: indLessonIds });
    if (studentIds.length) attWhere.push({ studentId: studentIds });
    if (attWhere.length) await Attendance.destroy({ where: { [Op.or]: attWhere } });

    await PaymentRecord.destroy({ where: { teacherId: teacher.id } });
    await IndividualLesson.destroy({ where: { teacherId: teacher.id } });
    await IndividualCourse.destroy({ where: { teacherId: teacher.id } });
    if (lessonIds.length) await Lesson.destroy({ where: { id: lessonIds } });
    if (groupIds.length) await GroupStudent.destroy({ where: { groupId: groupIds } });
    await Group.destroy({ where: { teacherId: teacher.id } });
    await Student.destroy({ where: { teacherId: teacher.id } });
    await TeacherStudent.destroy({ where: { teacherId: teacher.id } });
  }
  // Демо-пользователи (учитель + реальные ученики)
  await User.destroy({ where: { email: { [Op.like]: '%@linguaflow.demo' } } });
}

async function seed() {
  // Защита: демо-аккаунты с известным паролем НЕ должны попадать в production.
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    console.error('❌ Отказ: демо-сид в production запрещён (аккаунты с известным паролем). Используйте --force осознанно.');
    process.exit(1);
  }
  console.log('🧹 Чистим прежние демо-данные…');
  await cleanup();

  console.log('👨‍🏫 Создаём учителя…');
  const teacher = await User.create({
    name: 'Демо Преподаватель', email: 'demo.teacher@linguaflow.demo', password: PASS,
    role: 'teacher', emailVerified: true, username: 'demo_teacher',
    bio: 'Преподаватель польского. Демо-аккаунт для показа возможностей.',
  });

  console.log('🧑‍🎓 Создаём реальных учеников (аккаунты)…');
  const realDefs = [
    ['Anna Kowalska', 'anna_k'], ['Piotr Wójcik', 'piotr_w'],
    ['Olena Shevchenko', 'olena_s'], ['Marek Zieliński', 'marek_z'],
    ['Kasia Nowak', 'kasia_n'], ['Dmytro Bondar', 'dmytro_b'],
  ];
  const realStudents = []; // { user, student }
  for (const [name, username] of realDefs) {
    const user = await User.create({
      name, email: `${username}@linguaflow.demo`, password: PASS,
      role: 'student', emailVerified: true, username,
    });
    // Student-запись ростера (реальный: userId заполнен) + TeacherStudent (для «Мои ученики»)
    const student = await Student.create({ teacherId: teacher.id, userId: user.id, name });
    await TeacherStudent.create({ teacherId: teacher.id, studentId: user.id });
    realStudents.push({ user, student });
  }

  console.log('👤 Создаём заглушки (без аккаунтов)…');
  const phDefs = [
    ['Иван (пробный)', '+48 600 111 222'], ['Zofia Lewandowska', 'telegram: @zofia'],
    ['Тарас Мельник', '+380 67 123 4567'], ['Lena (с сайта)', null],
  ];
  const placeholders = [];
  for (const [name, contact] of phDefs) {
    placeholders.push(await Student.create({ teacherId: teacher.id, userId: null, name, contact }));
  }

  // Пул всех Student-записей для распределения по группам
  const S = realStudents.map(r => r.student);
  const P = placeholders;

  console.log('👥 Создаём группы + состав…');
  const groupDefs = [
    { name: 'Польский A1 — вечер', price: 60, chatLink: 'https://t.me/demo_a1',
      schedule: [{ day: 1, time: '18:00' }, { day: 3, time: '18:00' }],
      members: [S[0], S[1], P[0], P[1]] },
    { name: 'Польский A2 — утро', price: 70, chatLink: 'https://t.me/demo_a2',
      schedule: [{ day: 2, time: '10:00' }, { day: 4, time: '10:00' }],
      members: [S[2], S[3], S[4]] },
    { name: 'Разговорный клуб', price: 50, chatLink: null,
      schedule: [{ day: 5, time: '19:00' }],
      members: [S[0], S[4], S[5], P[2]] },
    { name: 'Интенсив B1', price: 90, chatLink: 'https://chat.whatsapp.com/demoB1',
      schedule: [{ day: 6, time: '12:00' }],
      members: [S[1], S[3], S[5], P[3]] },
  ];

  const chargedByStudent = new Map(); // Student.id → начислено (для оплат)
  const addCharge = (sid, amt) => chargedByStudent.set(sid, (chargedByStudent.get(sid) || 0) + amt);

  let totLessons = 0, totAtt = 0;
  const pastGroupLessons = []; // для ДЗ

  for (const g of groupDefs) {
    const group = await Group.create({
      name: g.name, teacherId: teacher.id, schedule: g.schedule,
      pricePerLesson: g.price, chatLink: g.chatLink, lessonLink: 'https://meet.google.com/demo',
    });
    for (const st of g.members) await GroupStudent.create({ groupId: group.id, studentId: st.id });

    const slots = lessonSlots(g.schedule, RANGE_FROM, RANGE_TO);
    let li = 0;
    for (const slot of slots) {
      const lesson = await Lesson.create({
        groupId: group.id, date: slot.date, time: slot.time,
        topic: `${g.name}: занятие ${li + 1}`,
      });
      totLessons++;
      if (isPast(slot.date)) {
        pastGroupLessons.push({ lesson, group, members: g.members });
        // Посещаемость по каждому ученику группы — разные статусы
        let si = 0;
        for (const st of g.members) {
          const r = (si + li) % 10;
          let rec;
          if (r === 0) rec = { teacherMarked: true, studentMarked: null, present: null, status: 'pending_student' };
          else if (r === 1) rec = { teacherMarked: true, studentMarked: false, present: false, status: 'disputed' };
          else if (r === 2) rec = { teacherMarked: false, studentMarked: false, present: false, status: 'confirmed' };
          else rec = { teacherMarked: true, studentMarked: true, present: true, status: 'confirmed' };

          await Attendance.create({ lessonId: lesson.id, studentId: st.id, ...rec });
          totAtt++;
          if (rec.present === true) addCharge(st.id, Number(g.price));
          si++;
        }
      }
      li++;
    }
  }

  console.log('📝 Создаём ДЗ + сдачи…');
  const hwLessons = pastGroupLessons.filter((_, i) => i % 5 === 0).slice(0, 5);
  for (let i = 0; i < hwLessons.length; i++) {
    const { lesson, members } = hwLessons[i];
    const hw = await Homework.create({
      lessonId: lesson.id,
      description: `Упражнения по теме урока ${i + 1}: слова + грамматика`,
      deadline: new Date(`${lesson.date}T23:59:00Z`),
    });
    // часть учеников сдала; часть сдач оценена
    let j = 0;
    for (const st of members) {
      if (j % 2 === 0) {
        const graded = j % 4 === 0;
        await HomeworkSubmission.create({
          homeworkId: hw.id, studentId: st.id,
          comment: 'Готово, проверьте пожалуйста.',
          fileUrl: null,
          grade: graded ? 80 + (j % 3) * 5 : null,
          status: graded ? 'graded' : 'pending',
        });
      }
      j++;
    }
  }

  console.log('🎓 Создаём индивидуальный курс + уроки…');
  const courseStudent = realStudents[2].student; // Olena
  const course = await IndividualCourse.create({
    teacherId: teacher.id, studentId: courseStudent.id, name: 'Инд. курс — Olena (B1)',
    schedule: [{ day: 3, time: '16:00' }], pricePerLesson: 120, lessonLink: 'https://meet.google.com/demo-ind',
  });
  for (const slot of lessonSlots(course.schedule, RANGE_FROM, RANGE_TO)) {
    const il = await IndividualLesson.create({
      teacherId: teacher.id, studentId: courseStudent.id, individualCourseId: course.id,
      date: slot.date, time: slot.time, topic: 'Индивидуальное занятие', pricePerLesson: 120,
    });
    if (isPast(slot.date)) {
      await Attendance.create({ individualLessonId: il.id, studentId: courseStudent.id,
        teacherMarked: true, studentMarked: true, present: true, status: 'confirmed' });
      addCharge(courseStudent.id, 120);
      totAtt++;
    }
    totLessons++;
  }

  console.log('🎯 Создаём разовый индивидуальный урок (заглушка)…');
  const oneOff = await IndividualLesson.create({
    teacherId: teacher.id, studentId: placeholders[0].id,
    date: '2026-06-20', time: '17:00', topic: 'Пробный индивидуальный урок', pricePerLesson: 100,
  });
  await Attendance.create({ individualLessonId: oneOff.id, studentId: placeholders[0].id,
    teacherMarked: true, studentMarked: true, present: true, status: 'confirmed' });
  addCharge(placeholders[0].id, 100);
  totAtt++; totLessons++;

  console.log('💳 Создаём оплаты (разный уровень долга)…');
  const ratios = [1.0, 0.6, 0.3, 0.0, 0.85, 0.5]; // по индексу студента
  const allStudents = [...S, ...P];
  let ri = 0, totPay = 0;
  for (const st of allStudents) {
    const charged = chargedByStudent.get(st.id) || 0;
    if (charged <= 0) { ri++; continue; }
    const ratio = ratios[ri % ratios.length];
    const amount = Math.round(charged * ratio);
    if (amount > 0) {
      await PaymentRecord.create({ studentId: st.id, teacherId: teacher.id, amount, paidAt: new Date('2026-06-15T12:00:00Z') });
      totPay++;
    }
    ri++;
  }

  console.log('\n✅ ГОТОВО. Демо-данные созданы:');
  console.log(`   учитель:            demo.teacher@linguaflow.demo / Demo1234!`);
  console.log(`   реальных учеников:  ${realStudents.length} (логин: <username>@linguaflow.demo / Demo1234!, напр. anna_k@linguaflow.demo)`);
  console.log(`   заглушек:           ${placeholders.length}`);
  console.log(`   групп:              ${groupDefs.length}`);
  console.log(`   уроков (всего):     ${totLessons}`);
  console.log(`   записей посещ.:     ${totAtt}`);
  console.log(`   оплат внесено:      ${totPay}`);
  console.log(`   инд. курс:          1 (+ уроки),  разовый инд. урок: 1`);
}

// Режим --clean: только удалить демо (@linguaflow.demo), без пересоздания.
// Использовать перед публичным запуском: node seed-demo.js --clean
async function cleanOnly() {
  console.log('🧹 Удаляю демо-данные (@linguaflow.demo)…');
  await cleanup();
  console.log('✅ Демо-данные удалены.');
}

const run = process.argv.includes('--clean') ? cleanOnly : seed;

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error('❌ Ошибка:', e); process.exit(1); });
