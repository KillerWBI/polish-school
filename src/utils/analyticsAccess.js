const { Group, User, IndividualCourse } = require('../models');

/**
 * Может ли requester видеть аналитику студента?
 *
 * Правила:
 *  - студент видит свою аналитику всегда
 *  - учитель видит, если студент в его группе ИЛИ в его инд. курсе
 *  - иначе — нет
 *
 * @param {string} requesterId — id текущего пользователя (req.user.id)
 * @param {string} studentId   — id студента, чью аналитику просят
 * @returns {Promise<boolean>}
 */
const canViewStudentAnalytics = async (requesterId, studentId) => {
  // Свои данные всегда можно
  if (requesterId === studentId) return true;

  // Связь через группу: ищем группу учителя, в которой состоит этот студент.
  // Идём через belongsToMany (Group→User as 'students'), это уже объявлено в models/index.js.
  // attributes: [] и through: { attributes: [] } — не тянем лишних полей, нам нужен только факт связи.
  const group = await Group.findOne({
    where: { teacherId: requesterId },
    attributes: ['id'],
    include: [{
      model: User,
      as: 'students',
      where: { id: studentId },
      attributes: [],
      through: { attributes: [] },
      required: true, // INNER JOIN — иначе вернёт группы без студента
    }],
  });
  if (group) return true;

  // Связь через индивидуальный курс
  const courseLink = await IndividualCourse.findOne({
    where: { teacherId: requesterId, studentId },
    attributes: ['id'],
  });
  return !!courseLink;
};

module.exports = { canViewStudentAnalytics };
