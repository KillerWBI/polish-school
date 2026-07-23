const { Op } = require('sequelize');
const { VocabItem, User } = require('../models');
const { overLimit, limitFor } = require('../config/planLimits');
const { enforceAi } = require('../utils/aiLimit');
const { generateVocab } = require('../services/aiQuiz');

// Интервалы SR (в днях) по числу верных ответов подряд: 1,2,4,8,16,32...
// nextReviewAt = now + 2^streak дней. Ошибка → показать через 1 час, сброс streak.
const KNOWN_THRESHOLD = 5; // 5 верных подряд → статус 'known'

// GET /vocab — мои слова. Фильтры: ?status= и ?language= (ISO-код).
// ?language=none — слова без языка (старые). Пагинация ?page=&limit=.
const list = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);

    // where — условие выборки. Наращиваем его по активным фильтрам.
    const where = { userId: req.user.id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.language === 'none') where.language = null;          // корзина «Без языка»
    else if (req.query.language)        where.language = req.query.language;

    const { count, rows } = await VocabItem.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    // Сводка по статусам — в рамках текущего языкового фильтра (чтобы чипы совпадали с фильтром).
    const countWhere = { userId: req.user.id };
    if (where.language !== undefined) countWhere.language = where.language;
    const all = await VocabItem.findAll({ where: countWhere, attributes: ['status'] });
    const counts = { new: 0, learning: 0, known: 0 };
    for (const v of all) counts[v.status] = (counts[v.status] ?? 0) + 1;

    // Какие языки вообще есть в словаре (для выпадающего фильтра). GROUP BY language → различные значения.
    const langRows = await VocabItem.findAll({
      where: { userId: req.user.id },
      attributes: ['language'],
      group: ['language'],
    });
    const languages = langRows.map((r) => r.language); // включая null (= «Без языка»)

    res.json({ data: rows, meta: { total: count, page, limit, pages: Math.ceil(count / limit), counts, languages } });
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

// POST /vocab — добавить одно слово
const create = async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const used = await VocabItem.count({ where: { userId: req.user.id } });
    if (overLimit(res, 'student', me?.plan, 'vocab', used)) return;

    const { word, translation, example, language, nativeLanguage } = req.body;
    const item = await VocabItem.create({
      userId: req.user.id,
      word, translation,
      example: example || null,
      language: language || null,
      nativeLanguage: nativeLanguage || null,
      // Новое слово доступно к повторению сразу
      nextReviewAt: new Date(),
    });
    res.status(201).json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка добавления слова' });
  }
};

// Вставить массив слов с учётом лимита тарифа. Берём столько, сколько ещё «влезает».
// Возвращает { created, added, skipped } (skipped — сколько не влезло по лимиту).
const insertWords = async (userId, plan, items, language, nativeLanguage) => {
  const max = limitFor('student', plan, 'vocab');       // максимум слов на тарифе
  const used = await VocabItem.count({ where: { userId } });
  const remaining = Math.max(0, max - used);            // сколько ещё можно добавить
  const toAdd = items.slice(0, remaining);              // отсекаем лишнее сверх лимита

  const rows = toAdd.map((it) => ({
    userId,
    word: it.word,
    translation: it.translation,
    example: it.example || null,
    language: language || null,
    nativeLanguage: nativeLanguage || null,
    nextReviewAt: new Date(),                            // доступно к повторению сразу
  }));

  const created = rows.length ? await VocabItem.bulkCreate(rows) : []; // одна пакетная вставка
  return { created, added: created.length, skipped: items.length - created.length };
};

// POST /vocab/bulk — добавить много слов сразу (массовая вставка «слово — перевод»).
// Body { items:[{word,translation,example?}], language?, nativeLanguage? } — уже провалидирован схемой.
const bulkCreate = async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const { items, language, nativeLanguage } = req.body;

    const r = await insertWords(req.user.id, me?.plan, items, language, nativeLanguage);
    if (!r.added) {
      return res.status(403).json({
        error: 'Достигнут лимит слов в словаре для вашего тарифа.', code: 'PLAN_LIMIT',
      });
    }
    res.status(201).json({ data: r.created, meta: { added: r.added, skipped: r.skipped } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка массового добавления' });
  }
};

// POST /vocab/generate — ИИ подбирает набор слов по теме и сразу кладёт их в словарь.
// Body { language, nativeLanguage, topic, count(1..100), level }.
const generate = async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { attributes: ['plan'] });
    const { language, nativeLanguage, topic, count, level } = req.body;

    // Если словарь уже под завязку — не тратим ИИ-вызов зря
    const used = await VocabItem.count({ where: { userId: req.user.id } });
    if (overLimit(res, 'student', me?.plan, 'vocab', used)) return;

    if (await enforceAi(res, req.user.id, 'student')) return; // дневной лимит ИИ (429 если исчерпан)

    // Анти-повтор: одним запросом берём уже существующие слова ЭТОГО языка → отдаём ИИ как avoid,
    // чтобы он не генерил дубли (без пословной сверки на сервере). Кап 300 — свежие.
    const existing = await VocabItem.findAll({
      where: { userId: req.user.id, language },
      attributes: ['word'],
      order: [['createdAt', 'DESC']],
      limit: 300,
    });
    const avoid = existing.map((v) => v.word);

    const words = await generateVocab({ language, nativeLanguage, topic, count, level, avoid });
    const r = await insertWords(req.user.id, me?.plan, words, language, nativeLanguage);

    res.status(201).json({ data: r.created, meta: { generated: words.length, added: r.added, skipped: r.skipped } });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('vocab.generate:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сгенерировать слова' });
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

module.exports = { list, due, create, bulkCreate, generate, update, review, remove };
