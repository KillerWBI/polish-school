const { Op, fn, col } = require('sequelize');
const { Post, PostLike, User, Follow, TeacherStudent } = require('../models');

// Поля автора для карточки поста
const AUTHOR_ATTRS = ['id', 'name', 'username', 'avatar', 'role'];

// Курсор офсетной пагинации по ранжированному окну. Непрозрачная base64-строка
// (фронт передаёт как есть) — внутри просто смещение в отсортированном списке.
const encodeCursor = (offset) => Buffer.from(String(offset)).toString('base64');

const decodeCursor = (raw) => {
  const n = parseInt(Buffer.from(raw, 'base64').toString('utf8'), 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

// ── Ранжирование ленты (фаза 3) ──────────────────────────────
// Скорим окно последних RECENT_WINDOW постов: свежесть (time-decay) +
// вовлечённость (лайки/просмотры) + совпадение языков + буст своих учителей.
// Веса — настроечные «ручки», отлаживаются на реальных данных.
const RECENT_WINDOW = 200;
const TAU_HOURS = 48; // период полу-затухания свежести
const W = { recency: 1.0, popularity: 1.2, lang: 0.6, boost: 0.8 };

const scorePost = (post, now, countMap, boosted, myLangs) => {
  const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 3.6e6);
  const recency = Math.exp(-ageHours / TAU_HOURS);                 // 1 (сейчас) → 0 (старое)
  const likes = countMap[post.id] || 0;
  const views = post.viewsCount || 0;
  const popularity = likes / (views + 3);                          // сглаженная вовлечённость
  const authorLangs = (post.author?.languages || []).map((l) => l.code);
  const langMatch = authorLangs.some((c) => myLangs.has(c)) ? 1 : 0;
  const isBoosted = boosted.has(post.authorId) ? 1 : 0;            // подписка/мой учитель
  return W.recency * recency + W.popularity * popularity + W.lang * langMatch + W.boost * isBoosted;
};

// Для набора постов собираем количество лайков и отметку «лайкнул ли я» —
// двумя запросами на всю пачку, без N+1.
const collectLikes = async (postIds, userId) => {
  if (postIds.length === 0) return { countMap: {}, mySet: new Set() };

  const counts = await PostLike.findAll({
    attributes: ['postId', [fn('COUNT', col('id')), 'cnt']],
    where: { postId: { [Op.in]: postIds } },
    group: ['postId'],
    raw: true,
  });
  const countMap = {};
  counts.forEach((r) => { countMap[r.postId] = Number(r.cnt); });

  const mine = await PostLike.findAll({
    attributes: ['postId'],
    where: { postId: { [Op.in]: postIds }, userId },
    raw: true,
  });
  const mySet = new Set(mine.map((r) => r.postId));

  return { countMap, mySet };
};

// Привести пост к форме ответа
const shapePost = (post, countMap, mySet) => ({
  id: post.id,
  text: post.text,
  media: post.media,
  viewsCount: post.viewsCount,
  createdAt: post.createdAt,
  author: post.author,
  likesCount: countMap[post.id] || 0,
  likedByMe: mySet.has(post.id),
});

// POST /posts — создать пост (любая роль)
const create = async (req, res) => {
  try {
    const post = await Post.create({
      authorId: req.user.id,
      text: req.body.text,
      media: req.body.media || [],
    });
    const author = await User.findByPk(req.user.id, { attributes: AUTHOR_ATTRS });
    post.setDataValue('author', author);
    res.status(201).json({ data: shapePost(post, {}, new Set()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания поста' });
  }
};

// DELETE /posts/:id — удалить свой пост (PostLikes снесутся каскадом)
const remove = async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    if (post.authorId !== req.user.id) {
      return res.status(403).json({ error: 'Можно удалять только свои посты' });
    }
    await post.destroy();
    res.json({ data: { message: 'Пост удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления поста' });
  }
};

// POST /posts/:id/like — лайкнуть. Идемпотентно (unique-индекс не даст дубль).
const like = async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id, { attributes: ['id'] });
    if (!post) return res.status(404).json({ error: 'Пост не найден' });
    await PostLike.findOrCreate({ where: { userId: req.user.id, postId: req.params.id } });
    res.status(201).json({ data: { message: 'Лайк поставлен' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка лайка' });
  }
};

// DELETE /posts/:id/like — снять лайк
const unlike = async (req, res) => {
  try {
    await PostLike.destroy({ where: { userId: req.user.id, postId: req.params.id } });
    res.json({ data: { message: 'Лайк снят' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка снятия лайка' });
  }
};

// GET /feed?cursor=&limit= — ранжированная лента (фаза 3).
// Берём окно последних RECENT_WINDOW постов → скорим в JS → пагинируем офсетом.
const getFeed = async (req, res) => {
  try {
    const me = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const offset = req.query.cursor ? decodeCursor(req.query.cursor) : 0;

    // Кого бустим (подписки + мои учителя) и языки зрителя — параллельно
    const [follows, teacherLinks, viewer] = await Promise.all([
      Follow.findAll({ where: { followerId: me }, attributes: ['followingId'], raw: true }),
      TeacherStudent.findAll({ where: { studentId: me }, attributes: ['teacherId'], raw: true }),
      User.findByPk(me, { attributes: ['languages'] }),
    ]);
    const boosted = new Set([...follows.map((f) => f.followingId), ...teacherLinks.map((t) => t.teacherId)]);
    const myLangs = new Set((viewer?.languages || []).map((l) => l.code));

    // Окно кандидатов — последние N постов (languages автора нужны для скоринга)
    const candidates = await Post.findAll({
      include: [{ model: User, as: 'author', attributes: [...AUTHOR_ATTRS, 'languages'] }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: RECENT_WINDOW,
    });

    const { countMap, mySet } = await collectLikes(candidates.map((p) => p.id), me);

    // Скорим и сортируем по убыванию
    const now = Date.now();
    const ranked = candidates
      .map((p) => ({ p, score: scorePost(p, now, countMap, boosted, myLangs) }))
      .sort((a, b) => b.score - a.score);

    const page = ranked.slice(offset, offset + limit).map((r) => r.p);
    const pageIds = page.map((p) => p.id);

    // Инкремент просмотров — одним UPDATE на отданную страницу
    if (pageIds.length > 0) {
      await Post.increment('viewsCount', { by: 1, where: { id: { [Op.in]: pageIds } } });
    }

    const hasMore = offset + limit < ranked.length;
    res.json({
      // эта выдача = просмотр, поэтому отражаем +1 уже в текущем ответе
      data: page.map((p) => {
        const shaped = shapePost(p, countMap, mySet);
        shaped.viewsCount += 1;
        return shaped;
      }),
      nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки ленты' });
  }
};

// GET /posts?authorId= — посты автора для таба в профиле (без инкремента просмотров)
const getByAuthor = async (req, res) => {
  try {
    const authorId = req.query.authorId;
    if (!authorId) return res.status(400).json({ error: 'Укажите authorId' });

    const posts = await Post.findAll({
      where: { authorId },
      include: [{ model: User, as: 'author', attributes: AUTHOR_ATTRS }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 20,
    });

    const { countMap, mySet } = await collectLikes(posts.map((p) => p.id), req.user.id);
    res.json({ data: posts.map((p) => shapePost(p, countMap, mySet)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки постов' });
  }
};

module.exports = { create, remove, like, unlike, getFeed, getByAuthor };
