const { Op } = require('sequelize');
const { Topic, TrackCard } = require('../models');
const { generateFlashcards, generateFlashcardsFromText } = require('../services/aiQuiz');
const { computeSr } = require('../utils/sr');
const { enforceAi } = require('../utils/aiLimit');

// Проверка, что трек принадлежит текущему ученику
const findOwnTopic = (topicId, userId) =>
  Topic.findOne({ where: { id: topicId, userId } });

const findStep = (roadmap, stepId) =>
  (Array.isArray(roadmap) ? roadmap : []).find((s) => s.id === stepId);

// POST /topics/:id/cards/generate — сгенерировать карточки по шагу и сохранить
const generate = async (req, res) => {
  try {
    const topic = await findOwnTopic(req.params.id, req.user.id);
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId, count } = req.body;
    const step = findStep(topic.roadmap, stepId);
    if (!step) return res.status(400).json({ error: 'Шаг не найден' });

    if (await enforceAi(res, req.user.id, 'student')) return; // дневной лимит ИИ

    const n = Math.min(15, Math.max(4, parseInt(count) || 8));
    const cardTopic = step.title === topic.title ? topic.title : `${topic.title} — ${step.title}`;
    const cards = await generateFlashcards({
      title: cardTopic,
      subject: topic.subject,
      language: 'русский',
      count: n,
    });

    const created = await TrackCard.bulkCreate(
      cards.map((c) => ({
        userId: req.user.id,
        topicId: topic.id,
        stepId,
        front: c.front,
        back: c.back,
        nextReviewAt: new Date(),
      }))
    );
    res.status(201).json({ data: created });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('trackCard.generate:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сгенерировать карточки' });
  }
};

// POST /topics/:id/cards/from-text — сделать карточки из вставленного текста и сохранить
const fromText = async (req, res) => {
  try {
    const topic = await findOwnTopic(req.params.id, req.user.id);
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId, text, count } = req.body;
    const step = findStep(topic.roadmap, stepId);
    if (!step) return res.status(400).json({ error: 'Шаг не найден' });
    if (!text || String(text).trim().length < 30) {
      return res.status(400).json({ error: 'Вставьте текст (хотя бы пару предложений)' });
    }

    if (await enforceAi(res, req.user.id, 'student')) return; // дневной лимит ИИ

    const n = Math.min(20, Math.max(4, parseInt(count) || 10));
    const cards = await generateFlashcardsFromText({ text, language: 'русский', count: n });

    const created = await TrackCard.bulkCreate(
      cards.map((c) => ({ userId: req.user.id, topicId: topic.id, stepId, front: c.front, back: c.back, nextReviewAt: new Date() }))
    );
    res.status(201).json({ data: created });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('trackCard.fromText:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сделать карточки из текста' });
  }
};

// GET /topics/:id/cards — карточки трека (?stepId= фильтр) + счётчик due
const list = async (req, res) => {
  try {
    const topic = await findOwnTopic(req.params.id, req.user.id);
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const where = { userId: req.user.id, topicId: topic.id };
    if (req.query.stepId) where.stepId = req.query.stepId;

    const cards = await TrackCard.findAll({ where, order: [['createdAt', 'ASC']] });
    const dueCount = await TrackCard.count({
      where: {
        userId: req.user.id,
        topicId: topic.id,
        status: { [Op.ne]: 'known' },
        nextReviewAt: { [Op.lte]: new Date() },
      },
    });
    res.json({ data: cards, meta: { dueCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения карточек' });
  }
};

// GET /topics/:id/cards/due — карточки к повторению сейчас (по всему треку)
const due = async (req, res) => {
  try {
    const topic = await findOwnTopic(req.params.id, req.user.id);
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const cards = await TrackCard.findAll({
      where: {
        userId: req.user.id,
        topicId: topic.id,
        status: { [Op.ne]: 'known' },
        nextReviewAt: { [Op.lte]: new Date() },
      },
      order: [['nextReviewAt', 'ASC']],
      limit: 50,
    });
    res.json({ data: cards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения карточек к повторению' });
  }
};

// PATCH /topics/:id/cards/:cardId/review — результат повторения (SR)
const review = async (req, res) => {
  try {
    const card = await TrackCard.findOne({
      where: { id: req.params.cardId, topicId: req.params.id, userId: req.user.id },
    });
    if (!card) return res.status(404).json({ error: 'Карточка не найдена' });

    const sr = computeSr(card.correctStreak, !!req.body.correct);
    await card.update(sr);
    res.json({ data: card });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
};

// DELETE /topics/:id/cards/:cardId
const remove = async (req, res) => {
  try {
    const n = await TrackCard.destroy({
      where: { id: req.params.cardId, topicId: req.params.id, userId: req.user.id },
    });
    if (!n) return res.status(404).json({ error: 'Карточка не найдена' });
    res.json({ data: { id: req.params.cardId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления карточки' });
  }
};

module.exports = { generate, fromText, list, due, review, remove };
