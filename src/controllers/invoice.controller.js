const { Op } = require('sequelize');
const {
  Invoice, Student, User, Attendance, Lesson, Group, IndividualLesson, IndividualCourse, PaymentRecord,
} = require('../models');
const { createNotification } = require('../utils/notify');

// Счёт на оплату. Модель денег не меняется: постоплата, счёт лишь оформляет
// уже начисленное за период. «Счёт на оплату» (Rachunek), не Faktura VAT —
// это не налоговый документ, и называть его так было бы неверно.

/**
 * Позиции счёта: по строке на каждое подтверждённое посещение за период.
 *
 * Сознательно НЕ переиспользуем `fetchChargesAndPayments`: тот считает итог по ученику
 * без разбивки и без периода, а в счёте нужны именно строки — за что человек платит.
 * Общий у них только принцип: деньги начисляются за present: true, и ни за что больше.
 */
const buildPositions = async (studentId, teacherId, from, to) => {
  const period = { [Op.between]: [from, to] };

  const [groupAtt, indAtt] = await Promise.all([
    Attendance.findAll({
      where: { studentId, present: true },
      attributes: ['id'],
      include: [{
        model: Lesson,
        required: true,
        where: { date: period },
        attributes: ['date', 'topic'],
        include: [{ model: Group, required: true, where: { teacherId }, attributes: ['name', 'pricePerLesson'] }],
      }],
    }),
    Attendance.findAll({
      where: { studentId, present: true },
      attributes: ['id'],
      include: [{
        model: IndividualLesson,
        required: true,
        where: { teacherId, date: period },
        attributes: ['date', 'topic', 'pricePerLesson'],
        include: [{ model: IndividualCourse, attributes: ['name'] }],
      }],
    }),
  ]);

  const positions = [
    ...groupAtt.map((a) => ({
      date:  a.Lesson.date,
      title: a.Lesson.topic || a.Lesson.Group.name,
      price: parseFloat(a.Lesson.Group.pricePerLesson) || 0,
    })),
    ...indAtt.map((a) => ({
      date:  a.IndividualLesson.date,
      title: a.IndividualLesson.topic || a.IndividualLesson.IndividualCourse?.name || 'Индивидуальное занятие',
      price: parseFloat(a.IndividualLesson.pricePerLesson) || 0,
    })),
  ].sort((x, y) => (x.date < y.date ? -1 : 1));

  const total = positions.reduce((s, p) => s + p.price, 0);
  return { positions, total };
};

// GET /invoices/preview?studentId=&from=&to= — что попадёт в счёт, до его выпуска.
// Отдельный эндпоинт, потому что выставление счёта — необратимый шаг (номер расходуется),
// и преподаватель должен увидеть строки до того, как документ появится.
const preview = async (req, res) => {
  try {
    const { studentId, from, to } = req.validatedQuery || req.query;

    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });
    if (student.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const { positions, total } = await buildPositions(studentId, req.user.id, from, to);
    res.json({ data: { positions, total, currency: req.user.currency || 'PLN' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка расчёта счёта' });
  }
};

/**
 * POST /invoices — выставить счёт.
 *
 * Нумерация: берём MAX(number)+1 у этого преподавателя и полагаемся на уникальный
 * индекс (teacherId, number). Два одновременных запроса возьмут одно число, второй
 * упадёт на индексе — повторяем. Это надёжнее блокировки таблицы и не мешает
 * остальным преподавателям выставлять счета в тот же момент.
 */
const create = async (req, res) => {
  try {
    const { studentId, from, to, dueDate, note } = req.body;

    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ error: 'Ученик не найден' });
    if (student.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const { positions, total } = await buildPositions(studentId, req.user.id, from, to);
    if (!positions.length) {
      return res.status(400).json({ error: 'За выбранный период нет занятий — выставлять нечего' });
    }

    const teacher = await User.findByPk(req.user.id, { attributes: ['currency', 'name'] });

    let invoice = null;
    for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
      const max = await Invoice.max('number', { where: { teacherId: req.user.id } });
      try {
        invoice = await Invoice.create({
          teacherId:  req.user.id,
          studentId,
          number:     (max || 0) + 1,
          currency:   teacher?.currency || 'PLN',
          periodFrom: from,
          periodTo:   to,
          issuedAt:   new Date().toISOString().slice(0, 10),
          dueDate:    dueDate || null,
          positions,
          total,
          note:       note || null,
        });
      } catch (e) {
        // Занятый номер — не ошибка запроса, а гонка: пробуем следующий
        if (e.name !== 'SequelizeUniqueConstraintError') throw e;
      }
    }
    if (!invoice) return res.status(409).json({ error: 'Не удалось присвоить номер, попробуйте ещё раз' });

    // Ученику с аккаунтом счёт приходит уведомлением; ученику без аккаунта —
    // никуда, его счёт преподаватель распечатает или перешлёт сам.
    if (student.userId) {
      createNotification(student.userId, {
        type: 'invoice_issued',
        title: 'Выставлен счёт на оплату',
        body: `№ ${invoice.number} · ${total} ${invoice.currency}`,
        link: '/payments?tab=invoices',
      });
    }

    res.status(201).json({ data: invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка выставления счёта' });
  }
};

// GET /invoices — роль-свитч: преподаватель видит выставленные им, ученик — свои.
const getAll = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'teacher') {
      where.teacherId = req.user.id;
    } else {
      // У ученика может быть несколько карточек Student — по одной у каждого преподавателя
      const students = await Student.findAll({ where: { userId: req.user.id }, attributes: ['id'] });
      if (!students.length) return res.json({ data: [] });
      where.studentId = students.map((s) => s.id);
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Student, as: 'student', attributes: ['id', 'name'] },
        { model: User, as: 'teacher', attributes: ['id', 'name', 'paymentDetails'] },
      ],
      order: [['number', 'DESC']],
    });
    res.json({ data: invoices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения счетов' });
  }
};

// GET /invoices/:id — сам документ (для печати). Доступ у обеих сторон счёта.
const getOne = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Student, as: 'student', attributes: ['id', 'name', 'userId'] },
        { model: User, as: 'teacher', attributes: ['id', 'name', 'email', 'paymentDetails'] },
      ],
    });
    if (!invoice) return res.status(404).json({ error: 'Счёт не найден' });

    const mine = req.user.role === 'teacher'
      ? invoice.teacherId === req.user.id
      : invoice.student?.userId === req.user.id;
    if (!mine) return res.status(403).json({ error: 'Доступ запрещён' });

    res.json({ data: invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения счёта' });
  }
};

// PATCH /invoices/:id — преподаватель помечает счёт оплаченным или отзывает его.
// Отдельной оплаты здесь не создаём: деньги вносятся существующим потоком в /payments,
// иначе одна и та же сумма попала бы в долг дважды.
const patch = async (req, res) => {
  try {
    const { status } = req.body; // paid | cancelled — проверено схемой

    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Счёт не найден' });
    if (invoice.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    await invoice.update({ status });
    res.json({ data: invoice });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления счёта' });
  }
};

// DELETE /invoices/:id — удалить можно только отозванный счёт: выставленный документ
// с присвоенным номером не должен бесследно исчезать из нумерации.
const remove = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Счёт не найден' });
    if (invoice.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });
    if (invoice.status !== 'cancelled') {
      return res.status(400).json({ error: 'Сначала отзовите счёт' });
    }

    await PaymentRecord.update({ invoiceId: null }, { where: { invoiceId: invoice.id } });
    await invoice.destroy();
    res.json({ data: { message: 'Счёт удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления счёта' });
  }
};

module.exports = { preview, create, getAll, getOne, patch, remove };
