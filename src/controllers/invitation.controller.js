const { Invitation, Group, User, Student, GroupStudent, TeacherStudent } = require('../models');
const { resolveStudent } = require('../utils/students');
const { createNotification } = require('../utils/notify');

const USER_BRIEF = ['id', 'name', 'username', 'avatar'];

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

module.exports = { create, getAll, patch };
