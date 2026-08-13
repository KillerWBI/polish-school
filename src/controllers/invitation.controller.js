const crypto = require('crypto');
const { Invitation, Group, User, Student, GroupStudent, TeacherStudent } = require('../models');
const { resolveStudent } = require('../utils/students');
const { createNotification } = require('../utils/notify');
const { sendStudentInviteEmail } = require('../services/email');
const { LIMITS } = require('../config/planLimits');

const USER_BRIEF = ['id', 'name', 'username', 'avatar'];

// Приглашение живёт две недели: за это время человек либо принял, либо уже не примет,
// а утёкшая ссылка перестаёт работать сама.
const INVITE_TTL_DAYS = 14;

// Сколько учеников ещё можно добавить в рамках тарифа. Отправленные, но не принятые
// приглашения считаем занятыми местами — иначе можно разослать больше, чем влезет.
const remainingStudents = (plan, used) => {
  const max = LIMITS?.teacher?.[plan || 'free']?.students;
  if (!max) return Number.MAX_SAFE_INTEGER; // лимит не задан — не ограничиваем
  return Math.max(0, max - used);
};

// POST /groups/:id/invitations — учитель приглашает студента (по User.id) в группу.
// Если приглашаемый уже «свой» реальный ученик (есть Student{userId} у этого учителя,
// из любой другой группы) — приглашение не нужно, добавляем в группу прямо (решение С3 п.3).
const create = async (req, res) => {
  try {
    const { inviteeUserId } = req.body;
    const groupId = req.params.id;

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const invitee = await User.findByPk(inviteeUserId);
    if (!invitee || invitee.role !== 'student') {
      return res.status(404).json({ error: 'Студент не найден' });
    }

    // Уже мой реальный ученик (в любой другой группе/курсе) — приглашение не нужно
    const existingStudent = await Student.findOne({
      where: { teacherId: req.user.id, userId: inviteeUserId },
    });
    if (existingStudent) {
      const alreadyInGroup = await GroupStudent.findOne({
        where: { groupId, studentId: existingStudent.id },
      });
      if (alreadyInGroup) return res.status(400).json({ error: 'Студент уже в группе' });

      await GroupStudent.create({ groupId, studentId: existingStudent.id });
      return res.status(201).json({ data: { directAdd: true, message: 'Студент уже ваш — добавлен в группу без приглашения' } });
    }

    const pending = await Invitation.findOne({
      where: { teacherId: req.user.id, groupId, inviteeUserId, status: 'pending' },
    });
    if (pending) return res.status(400).json({ error: 'Приглашение уже отправлено' });

    const invitation = await Invitation.create({
      teacherId: req.user.id,
      groupId,
      inviteeUserId,
      status: 'pending',
    });

    // Уведомляем приглашённого ученика (fire-and-forget)
    createNotification(inviteeUserId, {
      type: 'invitation_received',
      title: 'Приглашение в группу',
      body: `«${group.name}»`,
      link: '/groups',
    });

    res.status(201).json({ data: invitation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки приглашения' });
  }
};

// GET /invitations — роль-свитч: учитель видит исходящие, студент — входящие.
const getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    let invitations;
    if (req.user.role === 'teacher') {
      where.teacherId = req.user.id;
      invitations = await Invitation.findAll({
        where,
        include: [
          { model: User, as: 'invitee', attributes: USER_BRIEF },
          { model: Group, attributes: ['id', 'name'] },
        ],
        order: [['createdAt', 'DESC']],
      });
    } else {
      where.inviteeUserId = req.user.id;
      invitations = await Invitation.findAll({
        where,
        include: [
          { model: User, as: 'teacher', attributes: USER_BRIEF },
          { model: Group, attributes: ['id', 'name'] },
        ],
        order: [['createdAt', 'DESC']],
      });
    }
    res.json({ data: invitations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения приглашений' });
  }
};

// PATCH /invitations/:id — студент принимает (accept) или отклоняет (decline).
// accept → транзакцией: resolveStudent → членство в группе → TeacherStudent (параллельный гейт, решение С3 п.2).
const patch = async (req, res) => {
  try {
    const { status } = req.body; // accepted | declined — проверено схемой

    const invitation = await Invitation.findByPk(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Приглашение не найдено' });
    if (invitation.inviteeUserId !== req.user.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Приглашение уже обработано' });
    }

    if (status === 'accepted') {
      const user = await User.findByPk(req.user.id, { attributes: ['name'] });
      await Invitation.sequelize.transaction(async (t) => {
        await invitation.update({ status: 'accepted' }, { transaction: t });
        const student = await resolveStudent(invitation.teacherId, req.user.id, user.name);
        await GroupStudent.findOrCreate({
          where: { groupId: invitation.groupId, studentId: student.id },
          transaction: t,
        });
        await TeacherStudent.findOrCreate({
          where: { teacherId: invitation.teacherId, studentId: req.user.id },
          transaction: t,
        });
      });
    } else {
      await invitation.update({ status: 'declined' });
    }

    res.json({ data: invitation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обработки приглашения' });
  }
};

// DELETE /invitations/:id — учитель отменяет своё ещё не принятое приглашение.
// Обработанные (accepted/declined) не трогаем — это история, а не ожидание.
const remove = async (req, res) => {
  try {
    const invitation = await Invitation.findByPk(req.params.id);
    if (!invitation) return res.status(404).json({ error: 'Приглашение не найдено' });
    if (invitation.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Приглашение уже обработано — отменить нельзя' });
    }

    await invitation.destroy();
    res.json({ data: { message: 'Приглашение отменено' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отмены приглашения' });
  }
};

/**
 * POST /groups/:id/invitations/bulk — позвать в группу по email тех, кого ещё нет.
 *
 * Существующий `create` умеет звать только зарегистрированных: ищет по нику и пишет
 * `inviteeUserId`. Здесь аккаунта ещё нет, поэтому приглашение живёт по email + токену,
 * а userId проставится, когда человек зарегистрируется по ссылке из письма.
 *
 * Возвращает построчный результат по каждому адресу, а не «ок/не ок» на всю пачку:
 * из десяти адресов один почти всегда с опечаткой, и учителю нужно видеть — какой.
 */
const bulkInvite = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { emails } = req.body; // массив, нормализован схемой

    const group = await Group.findByPk(groupId);
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (group.teacherId !== req.user.id) return res.status(403).json({ error: 'Доступ запрещён' });

    const teacher = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'plan'] });

    // Лимит тарифа считаем ОДИН раз до рассылки и уменьшаем по ходу: иначе учитель
    // на бесплатном тарифе разослал бы сотню приглашений и упёрся в лимит уже после,
    // когда письма ушли и отозвать их нельзя.
    const usedStudents = await Student.count({ where: { teacherId: req.user.id } });
    const pendingCount = await Invitation.count({ where: { teacherId: req.user.id, status: 'pending' } });
    let budget = remainingStudents(teacher?.plan, usedStudents + pendingCount);

    const results = [];
    for (const email of emails) {
      if (budget <= 0) { results.push({ email, status: 'limit' }); continue; }

      // Уже зарегистрирован — обычное приглашение, письмо не нужно:
      // человек увидит его в приложении, где и так бывает.
      const existing = await User.findOne({ where: { email }, attributes: ['id'] });

      const [invitation, created] = await Invitation.findOrCreate({
        where: { teacherId: req.user.id, groupId, inviteeEmail: email, status: 'pending' },
        defaults: {
          teacherId: req.user.id,
          groupId,
          inviteeEmail: email,
          inviteeUserId: existing?.id || null,
          token: crypto.randomBytes(24).toString('hex'),
          expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      if (!created) { results.push({ email, status: 'already' }); continue; }

      budget--;

      if (existing) {
        // Уведомление внутри приложения — тот же путь, что у приглашения по нику
        await createNotification(existing.id, {
          type: 'invitation_received',
          title: 'Приглашение в группу',
          body: `${teacher.name} — «${group.name}»`,
          link: '/groups',
        });
        results.push({ email, status: 'notified' });
        continue;
      }

      // Письмо не должно ронять всю рассылку: один плохой адрес — одна плохая строка
      try {
        await sendStudentInviteEmail(email, {
          teacherName: teacher.name,
          groupName: group.name,
          token: invitation.token,
        });
        results.push({ email, status: 'sent' });
      } catch (e) {
        console.error('[invite] письмо не ушло:', email, e.message);
        results.push({ email, status: 'failed' });
      }
    }

    res.status(201).json({ data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка отправки приглашений' });
  }
};

module.exports = { create, getAll, patch, remove, bulkInvite };
