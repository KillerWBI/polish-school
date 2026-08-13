const { Op } = require('sequelize');
const { Invitation, StudentTeacher, GroupStudent, TeacherStudent } = require('../models');
const { resolveStudent } = require('../utils/students');

/**
 * Погашение токена приглашения сразу после регистрации.
 *
 * Смысл — убрать второй шаг. Без этого человек из письма попадал бы на пустой
 * кабинет с задачей «найдите приглашение и примите его», а каждый лишний шаг
 * между письмом и результатом теряет часть людей.
 *
 * Обе петли гасятся здесь же, потому что вызывающий (регистрация) не должен
 * знать, кого именно позвали — он просто передаёт токен из адреса.
 *
 * Ошибки намеренно не пробрасываем: битый или протухший токен не должен
 * отменять регистрацию. Человек просто окажется в обычном пустом кабинете.
 */
const acceptInviteToken = async (user, token) => {
  if (!token || typeof token !== 'string') return null;

  try {
    // --- Петля Б: учитель звал ученика в группу ---
    const invitation = await Invitation.findOne({
      where: {
        token,
        status: 'pending',
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }],
      },
    });

    if (invitation) {
      // Приглашали ученика — если по ссылке зарегистрировался учитель, не втягиваем
      // его в чужую группу: роль важнее токена.
      if (user.role !== 'student') return null;

      await Invitation.sequelize.transaction(async (t) => {
        await invitation.update(
          { status: 'accepted', inviteeUserId: user.id },
          { transaction: t },
        );
        // Тот же путь, что и при обычном принятии приглашения в приложении:
        // заводим/находим Student этого учителя и кладём в группу.
        const student = await resolveStudent(invitation.teacherId, user.id, user.name);
        await GroupStudent.findOrCreate({
          where: { groupId: invitation.groupId, studentId: student.id },
          transaction: t,
        });
        await TeacherStudent.findOrCreate({
          where: { teacherId: invitation.teacherId, studentId: user.id },
          transaction: t,
        });
      });

      await user.update({ invitedByUserId: invitation.teacherId });
      return { kind: 'group', teacherId: invitation.teacherId, groupId: invitation.groupId };
    }

    // --- Петля А: ученик звал своего офлайн-преподавателя ---
    const card = await StudentTeacher.findOne({ where: { inviteToken: token, linkedUserId: null } });
    if (card) {
      if (user.role !== 'teacher') return null;

      // Связываем карточку с аккаунтом — ученик увидит, что преподаватель уже здесь,
      // и не позовёт его повторно. Историю занятий НЕ переносим: это записи ученика
      // о деньгах, и превращать их в бухгалтерию преподавателя молча нельзя.
      await card.update({ linkedUserId: user.id });
      await user.update({ invitedByUserId: card.userId });
      return { kind: 'teacher', invitedByUserId: card.userId, studentTeacherId: card.id };
    }

    return null;
  } catch (err) {
    console.error('[invite] не удалось погасить токен:', err.message);
    return null;
  }
};

module.exports = { acceptInviteToken };
