const { Op } = require('sequelize');
const { VocabItem } = require('../models');

// Интервалы SR (в днях) по числу верных ответов подряд: 1,2,4,8,16,32...
// nextReviewAt = now + 2^streak дней. Ошибка → показать через 1 час, сброс streak.
const KNOWN_THRESHOLD = 5; // 5 верных подряд → статус 'known'

// GET /vocab — мои слова (фильтр ?status=, пагинация ?page=&limit=)
const list = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const where = { userId: req.user.id };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await VocabItem.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    // Сводка по статусам (по всему словарю, не только текущей странице)
    const all = await VocabItem.findAll({ where: { userId: req.user.id }, attributes: ['status'] });
    const counts = { new: 0, learning: 0, known: 0 };
    for (const v of all) counts[v.status] = (counts[v.status] ?? 0) + 1;

    res.json({ data: rows, meta: { total: count, page, limit, pages: Math.ceil(count / limit), counts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения словаря' });
  }
};

// GET /vocab/due — слова к повторению сегодня (nextReviewAt <= now), кроме known
const due = async (req, res) => {
  try {
    const rows = await VocabItem.findAll({
      where: {
        userId: req.user.id,
        status: { [Op.ne]: 'known' },
        nextReviewAt: { [Op.lte]: new Date() },
      },
      order: [['nextReviewAt', 'ASC']],
      limit: 50,
    });
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения слов к повторению' });
  }
};

// POST /vocab — добавить слово
const create = async (req, res) => {
  try {
    const { word, translation, example } = req.body;
    const item = await VocabItem.create({
      userId: req.user.id,
      word, translation,
      example: example || null,
      // Новое слово доступно к повторению сразу
      nextReviewAt: new Date(),
    });
    res.status(201).json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления слова' });
  }
};

// PUT /vocab/:id — редактировать (только своё)
const update = async (req, res) => {
  try {
    const item = await VocabItem.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!item) return res.status(404).json({ error: 'Слово не найдено' });
    const { word, translation, example } = req.body;
    await item.update({
      ...(word !== undefined && { word }),
      ...(translation !== undefined && { translation }),
      ...(example !== undefined && { example }),
    });
    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления слова' });
  }
};

// PATCH /vocab/:id/review — результат повторения (SR-обновление)
const review = async (req, res) => {
  try {
    const item = await VocabItem.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!item) return res.status(404).json({ error: 'Слово не найдено' });

    const { correct } = req.body;
    const next = new Date();

    if (correct) {
      const streak = item.correctStreak + 1;
      const intervalDays = Math.pow(2, item.correctStreak); // 1,2,4,8,16...
      next.setDate(next.getDate() + intervalDays);
      await item.update({
        correctStreak: streak,
        status: streak >= KNOWN_THRESHOLD ? 'known' : 'learning',
        nextReviewAt: next,
      });
    } else {
      next.setHours(next.getHours() + 1); // повторить через час
      await item.update({ correctStreak: 0, status: 'learning', nextReviewAt: next });
    }

    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
};

// DELETE /vocab/:id
const remove = async (req, res) => {
  try {
    const item = await VocabItem.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!item) return res.status(404).json({ error: 'Слово не найдено' });
    await item.destroy();
    res.json({ data: { id: item.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления слова' });
  }
};

module.exports = { list, due, create, update, review, remove };
