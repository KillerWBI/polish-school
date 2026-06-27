const { Student } = require('../models');

/**
 * Может ли requester видеть аналитику студента?
 *  - студент видит свою аналитику всегда (requesterId === studentId)
 *  - учитель видит, если у него есть Student-запись, привязанная к этому аккаунту
 *    (teacherId=requesterId, userId=studentId) — это и значит «мой ученик»
 *
 * @param {string} requesterId — User.id текущего пользователя
 * @param {string} studentId   — User.id студента, чью аналитику просят
 * @returns {Promise<boolean>}
 */
const canViewStudentAnalytics = async (requesterId, studentId) => {
  if (requesterId === studentId) return true;

  const link = await Student.findOne({
    where: { teacherId: requesterId, userId: studentId },
    attributes: ['id'],
  });
  return !!link;
};

module.exports = { canViewStudentAnalytics };
