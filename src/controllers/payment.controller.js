const { PaymentRecord, Attendance, Lesson, IndividualLesson, Group, GroupStudent, IndividualCourse, User, TeacherStudent } = require('../models');
const { Op } = require('sequelize');

// id студентов учителя: через его группы (GroupStudent) + индивидуальные курсы.
// Set убирает дубли, если студент и в группе, и на инд. курсе.
const getTeacherStudentIds = async (teacherId) => {
  const groups = await Group.findAll({ where: { teacherId }, attributes: ['id'] });
  const groupIds = groups.map(g => g.id);

  const [groupStudents, indCourses] = await Promise.all([
    groupIds.length
      ? GroupStudent.findAll({ where: { groupId: { [Op.in]: groupIds } }, attributes: ['studentId'] })
      : Promise.resolve([]),
    IndividualCourse.findAll({ where: { teacherId }, attributes: ['studentId'] }),
  ]);

  return [...new Set([
    ...groupStudents.map(r => r.studentId),
    ...indCourses.map(r => r.studentId),
  ])];
};

const getStudentDebtTotal = async (studentId) => {
  // Начислено по каждому учителю (из посещений)
  const charged = await computeChargedByTeacher(studentId);

  const records = await PaymentRecord.findAll({
    where: { studentId },
    attributes: ['teacherId', 'amount'],
  });
  // Map: teacherId → сумма оплаченного
  const paid = new Map();
  for (const r of records) {
    paid.set(r.teacherId, (paid.get(r.teacherId) ?? 0) + parseFloat(r.amount));
  }
  // Вычисляем долг по каждому учителю: сколько начислено минус сколько оплачено.
  const debt = {};
  for (const [teacherId, amount] of charged) {
    debt[teacherId] = amount - (paid.get(teacherId) ?? 0);
  }

  const allAmount = Object.values(debt).reduce( (sum, amt) => sum + amt , 0);
  return Math.max(allAmount, 0); // переплата не уводит долг в минус

};

// Сколько учителю должны ВСЕ его ученики суммарно (для KPI дашборда).
// По каждому ученику: начислено мной − оплачено мне, кламп ≥0,
// чтобы переплата одного не маскировала долг другого.
const getTeacherDebtTotal = async (teacherId) => {
  const studentIds = await getTeacherStudentIds(teacherId);
  let total = 0;
  for (const studentId of studentIds) {
    const charged = await computeChargedByTeacher(studentId);
    const chargedByMe = charged.get(teacherId) ?? 0;

    const records = await PaymentRecord.findAll({
      where: { studentId, teacherId },
      attributes: ['amount'],
    });
    const paidToMe = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    total += Math.max(chargedByMe - paidToMe, 0);
  }
  return total;
};

// Начислено студенту по каждому учителю: сумма цен подтверждённых посещений.
// Возвращает Map: teacherId → число (сумма в валюте).
const computeChargedByTeacher = async (studentId) => {
  const charged = new Map();

  // Групповые посещения: Attendance → Lesson → Group (teacherId + pricePerLesson)
  const groupAttendances = await Attendance.findAll({
    where: { studentId, present: true },
    include: [{
      model: Lesson,
      required: true,
      include: [{ model: Group, required: true, attributes: ['teacherId', 'pricePerLesson'] }],
    }],
  });
  for (const a of groupAttendances) {
    const { teacherId, pricePerLesson } = a.Lesson.Group;
    const price = parseFloat(pricePerLesson) || 0;
    charged.set(teacherId, (charged.get(teacherId) ?? 0) + price);
  }

  // Индивидуальные посещения: Attendance → IndividualLesson (teacherId + pricePerLesson)
  const indAttendances = await Attendance.findAll({
    where: { studentId, present: true },
    include: [{
      model: IndividualLesson,
      required: true,
      attributes: ['teacherId', 'pricePerLesson'],
    }],
  });
  for (const a of indAttendances) {
    const { teacherId, pricePerLesson } = a.IndividualLesson;
    const price = parseFloat(pricePerLesson) || 0;
    charged.set(teacherId, (charged.get(teacherId) ?? 0) + price);
  }

  return charged;
};

// POST /payments/record — учитель вносит оплату от ученика
const recordPayment = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { studentId, amount } = req.body;

    const link = await TeacherStudent.findOne({ where: { teacherId, studentId } });
    if (!link) return res.status(403).json({ error: 'Этот студент не является вашим учеником' });

    const record = await PaymentRecord.create({ studentId, teacherId, amount });
    res.status(201).json({ data: record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка записи оплаты' });
  }
};

// GET /payments/debt — студент видит долг по каждому учителю
const getDebt = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Начислено по каждому учителю (из посещений)
    const charged = await computeChargedByTeacher(studentId);

    // Оплачено по каждому учителю (из PaymentRecord)
    const records = await PaymentRecord.findAll({
      where: { studentId },
      attributes: ['teacherId', 'amount'],
    });
    const paid = new Map();
    for (const r of records) {
      paid.set(r.teacherId, (paid.get(r.teacherId) ?? 0) + parseFloat(r.amount));
    }

    // Объединяем все teacherId из обоих источников
    const teacherIds = [...new Set([...charged.keys(), ...paid.keys()])];
    if (teacherIds.length === 0) return res.json({ data: [] });

    const teachers = await User.findAll({
      where: { id: teacherIds },
      attributes: ['id', 'name', 'email'],
    });
    const teacherMap = new Map(teachers.map(t => [t.id, t]));

    const data = teacherIds.map(teacherId => {
      const chargedAmt = charged.get(teacherId) ?? 0;
      const paidAmt    = paid.get(teacherId) ?? 0;
      return {
        teacher: teacherMap.get(teacherId),
        charged: chargedAmt,
        paid:    paidAmt,
        balance: chargedAmt - paidAmt,
      };
    });

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения долга' });
  }
};

//[{ student: {id, name, email}, charged, paid, balance }]
const getDebtsForTeacher = async (req, res) => {
  try {
    const studentIds = await getTeacherStudentIds(req.user.id);
    if (studentIds.length === 0) {
      return res.json({ data: [] });
    }
    const students = await User.findAll ({ where: { id: studentIds }, attributes: ['id', 'name', 'email'] });
    const data = [];
    for (const student of students) {
      const charged = await computeChargedByTeacher(student.id);
      const paidRecords = await PaymentRecord.findAll({ where: { studentId: student.id , teacherId: req.user.id}, attributes: ['amount'] });
      //получаем в таком виде: [{amount: 100}, {amount: 200}]
      const paid = paidRecords.reduce( (sum, record) => sum + parseFloat(record.amount) || 0, 0 );
      data.push({
        student,
        charged: charged.get(req.user.id) ?? 0,
        paid: paid,
        balance: (charged.get(req.user.id) ?? 0) - paid,
      });
    }
    res.json({data});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения долгов' });
  }
};

module.exports = { computeChargedByTeacher, getDebt, recordPayment, getDebtsForTeacher, getStudentDebtTotal, getTeacherDebtTotal };
