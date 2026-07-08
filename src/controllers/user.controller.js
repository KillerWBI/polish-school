const { User, Follow, TeacherStudent, LessonRequest, Student } = require('../models');
const { Op } = require('sequelize');
const { isAllowedUploadUrl } = require('../utils/cloudinary');

// Поля, которые возвращаем в публичном профиле (без email, password, токенов)
const PUBLIC_PROFILE_FIELDS = [
  'id', 'name', 'username', 'role',
  'avatar', 'coverImage', 'bio',
  'socialTelegram', 'socialWhatsApp', 'socialLinkedIn', 'socialInstagram', 'phone',
  'languages', 'createdAt',
];

// Поля, которые пользователь может править в своём профиле
const EDITABLE_PROFILE_FIELDS = [
  'name', 'username', 'avatar', 'coverImage', 'bio',
  'socialTelegram', 'socialWhatsApp', 'socialLinkedIn', 'socialInstagram', 'phone', 'languages',
  'paymentDetails',
];

const USERNAME_RE = /^[a-z0-9_]{3,40}$/;

const getAll = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Без email (PII): для пикеров хватает имени/ника/аватара. Email чужих учеников не отдаём.
    const { count, rows } = await User.findAndCountAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'username', 'avatar'],
      limit,
      offset,
    });
    res.json({ data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
};

const getOne = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'role'],
    });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // студент может смотреть только себя
    if (req.user.role === 'student' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    res.json({ data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
};

const update = async (req, res) => {
  try {
    // Менять аккаунт может только его владелец — ни учитель, ни кто-либо ещё
    // не переименовывает чужие аккаунты. (Заглушки-ученики — это Student, правятся отдельно.)
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { name } = req.body;
    await user.update({ name });

    res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
};

// PUT /users/me/profile — обновление своего профиля (Instagram-style поля)
const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Берём только разрешённые поля из body
    const updates = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Username: формат + уникальность
    if (updates.username !== undefined) {
      updates.username = String(updates.username).toLowerCase().trim();
      if (!USERNAME_RE.test(updates.username)) {
        return res.status(400).json({ error: 'username: только латиница, цифры, _ (3-40 символов)' });
      }
      if (updates.username !== user.username) {
        const taken = await User.findOne({ where: { username: updates.username }, attributes: ['id'] });
        if (taken) return res.status(400).json({ error: 'Этот username уже занят' });
      }
    }

    // Bio: max 300 символов
    if (updates.bio !== undefined && updates.bio !== null && String(updates.bio).length > 300) {
      return res.status(400).json({ error: 'Bio не должно превышать 300 символов' });
    }

    // avatar/coverImage — только ссылки на наш Cloudinary (анти-фишинг/мусор)
    if (!isAllowedUploadUrl(updates.avatar) || !isAllowedUploadUrl(updates.coverImage)) {
      return res.status(400).json({ error: 'Недопустимая ссылка на изображение' });
    }

    // Languages: массив объектов { code, level? }
    if (updates.languages !== undefined) {
      if (!Array.isArray(updates.languages)) {
        return res.status(400).json({ error: 'languages должен быть массивом' });
      }
      for (const l of updates.languages) {
        if (!l || typeof l.code !== 'string' || !l.code.trim()) {
          return res.status(400).json({ error: 'Каждый язык должен иметь поле code' });
        }
      }
    }

    await user.update(updates);

    // Возвращаем обновлённый публичный профиль
    const fresh = await User.findByPk(user.id, { attributes: PUBLIC_PROFILE_FIELDS });
    res.json({ data: fresh });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Этот username уже занят' });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors?.[0]?.message || 'Ошибка валидации' });
    }
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
};

// Отношение текущего зрителя к просматриваемому профилю.
// Один блок вместо россыпи отдельных endpoint'ов (решение §2.5.6).
const buildViewerContext = async (viewer, profile) => {
  const ctx = {
    isOwnProfile: viewer.id === profile.id,
    isFollowing: false,
    requestStatus: null, // pending | accepted | declined | null
    isMyStudent: false,  // я (учитель) — наставник этого студента
    isMyTeacher: false,  // этот учитель — мой наставник
  };
  if (ctx.isOwnProfile) return ctx;

  // Все проверки отношения независимы → запускаем параллельно (Promise.all),
  // а не одну за другой. Каждая дописывает свой флаг в ctx.
  const tasks = [
    Follow.findOne({ where: { followerId: viewer.id, followingId: profile.id }, attributes: ['id'] })
      .then(r => { ctx.isFollowing = !!r; }),
  ];

  // Смотрю профиль учителя как студент → статус моей заявки + наставничество
  if (profile.role === 'teacher' && viewer.role === 'student') {
    tasks.push(
      LessonRequest.findOne({
        where: { studentId: viewer.id, teacherId: profile.id },
        order: [['createdAt', 'DESC']], attributes: ['status'],
      }).then(r => { ctx.requestStatus = r ? r.status : null; }),
      TeacherStudent.findOne({ where: { teacherId: profile.id, studentId: viewer.id }, attributes: ['id'] })
        .then(r => { ctx.isMyTeacher = !!r; }),
    );
  }

  // Смотрю профиль студента как учитель → мой ли это ученик
  if (profile.role === 'student' && viewer.role === 'teacher') {
    tasks.push(
      TeacherStudent.findOne({ where: { teacherId: viewer.id, studentId: profile.id }, attributes: ['id'] })
        .then(r => { ctx.isMyStudent = !!r; }),
    );
  }

  await Promise.all(tasks);
  return ctx;
};

// GET /users/@:username/profile — публичный профиль (для всех авторизованных)
const getPublicProfile = async (req, res) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const user = await User.findOne({
      where: { username },
      attributes: PUBLIC_PROFILE_FIELDS,
    });
    if (!user) return res.status(404).json({ error: 'Профиль не найден' });

    // viewerContext и счётчик подписчиков независимы → параллельно
    const [viewerContext, followersCount] = await Promise.all([
      buildViewerContext(req.user, user),
      Follow.count({ where: { followingId: user.id } }),
    ]);

    res.json({ data: { ...user.toJSON(), viewerContext, followersCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
};

// GET /users/me/students — список «моих учеников» (для StudentsPage и picker'а).
// Только учитель (роут защищён isTeacher).
const getMyStudents = async (req, res) => {
  try {
    // Ростер учителя = все Student-записи (реальные И заглушки). id = Student.id —
    // единый ключ для добавления в группы/инд.уроки и всех FK (teacher-first, REVISION).
    const students = await Student.findAll({
      where: { teacherId: req.user.id },
      attributes: ['id', 'userId', 'name', 'contact'],
      include: [{ model: User, as: 'account', attributes: ['username', 'avatar', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({
      data: students.map(s => ({
        id:            s.id,          // Student.id
        userId:        s.userId,
        name:          s.name,
        username:      s.account?.username ?? null,
        avatar:        s.account?.avatar ?? null,
        email:         s.account?.email ?? null,
        contact:       s.contact,
        isPlaceholder: !s.userId,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения учеников' });
  }
};

// GET /users/search?username= — учитель ищет учеников по ПОХОЖЕМУ нику или имени (С3, приглашения).
// Подстрочный поиск (iLike), но с минимумом 3 символа (схема) и лимитом 10 —
// достаточно для приглашения, но без выгрузки всей базы. Email не отдаём (PII).
const searchByUsername = async (req, res) => {
  try {
    const q = req.validatedQuery.username.trim().toLowerCase();
    const like = `%${q}%`;

    const users = await User.findAll({
      where: {
        role: 'student',
        [Op.or]: [
          { username: { [Op.iLike]: like } },
          { name:     { [Op.iLike]: like } },
        ],
      },
      attributes: ['id', 'name', 'username', 'avatar'],
      limit: 10,
      order: [['username', 'ASC']],
    });

    // Пометим, кто уже мой реальный ученик (одним запросом на всех).
    const ids = users.map(u => u.id);
    const mine = ids.length
      ? await Student.findAll({ where: { teacherId: req.user.id, userId: ids }, attributes: ['userId'] })
      : [];
    const mineSet = new Set(mine.map(m => m.userId));

    res.json({ data: users.map(u => ({ ...u.toJSON(), alreadyMine: mineSet.has(u.id) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка поиска ученика' });
  }
};

module.exports = { getAll, getOne, update, updateProfile, getPublicProfile, getMyStudents, searchByUsername };
