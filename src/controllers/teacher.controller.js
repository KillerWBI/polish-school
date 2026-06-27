const { User } = require('../models');
const { Op } = require('sequelize');

// Счётчики считаем подзапросом прямо в SELECT — без N+1 на каждого учителя.
// "User"."id" — алиас основной таблицы в запросе Sequelize по модели User.
const STUDENTS_COUNT  = '(SELECT COUNT(*) FROM "TeacherStudents" ts WHERE ts."teacherId"  = "User"."id")';
const FOLLOWERS_COUNT = '(SELECT COUNT(*) FROM "Follows"         f  WHERE f."followingId" = "User"."id")';

// GET /teachers/catalog — публичный список учителей с фильтром по языку и поиском.
const getCatalog = async (req, res) => {
  try {
    const { page, limit, language, q } = req.validatedQuery;
    const offset = (page - 1) * limit;

    const where = { role: 'teacher' };
    if (q) {
      where[Op.or] = [
        { name:     { [Op.iLike]: `%${q}%` } },
        { username: { [Op.iLike]: `%${q}%` } },
      ];
    }
    if (language) {
      // languages хранится как [{ code, level? }] → ищем @> [{ code: язык }].
      // JSONB-containment матчит частичный объект: [{code:'pl',level:'B2'}] @> [{code:'pl'}] = true.
      where.languages = { [Op.contains]: [{ code: language }] };
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: [
        'id', 'name', 'username', 'avatar', 'bio', 'languages',
        [User.sequelize.literal(STUDENTS_COUNT),  'studentsCount'],
        [User.sequelize.literal(FOLLOWERS_COUNT), 'followersCount'],
      ],
      order: [
        [User.sequelize.literal(STUDENTS_COUNT), 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки каталога' });
  }
};

module.exports = { getCatalog };
