const { Op } = require('sequelize');
const { TrackCard, VocabItem, Topic } = require('../models');
const { computeSr } = require('../utils/sr');

// GET /study/weak-spots — слабые места: практикованные шаги с низким обладанием (по всем трекам)
const weakSpots = async (req, res) => {
  try {
    const topics = await Topic.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'title', 'roadmap'],
    });
    const spots = [];
    for (const t of topics) {
      for (const step of (Array.isArray(t.roadmap) ? t.roadmap : [])) {
        if ((step.attempts || 0) > 0 && (Number(step.mastery) || 0) < 70) {
          spots.push({
            topicId: t.id, topicTitle: t.title,
            stepId: step.id, stepTitle: step.title,
            mastery: Math.round(Number(step.mastery) || 0), attempts: step.attempts || 0,
          });
        }
      }
    }
    spots.sort((a, b) => a.mastery - b.mastery); // слабейшие первыми
    res.json({ data: spots.slice(0, 12) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения слабых мест' });
  }
};

const SESSION_CAP = 40; // максимум карточек в одной сессии (5-мин формат)

// GET /study/session — собрать due-повторения со всех треков + словаря в одну сессию
const session = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const dueWhere = { userId, status: { [Op.ne]: 'known' }, nextReviewAt: { [Op.lte]: now } };

    const cards = await TrackCard.findAll({
      where: dueWhere,
      include: [{ model: Topic, as: 'topic', attributes: ['title'] }],
      order: [['nextReviewAt', 'ASC']],
      limit: SESSION_CAP,
    });
    const words = await VocabItem.findAll({
      where: dueWhere,
      order: [['nextReviewAt', 'ASC']],
      limit: SESSION_CAP,
    });

    // Нормализуем в общий формат карточки: { id, kind, front, back, context }
    const items = [
      ...cards.map((c) => ({
        id: c.id, kind: 'card', front: c.front, back: c.back,
        context: c.topic?.title || 'Учебный трек',
      })),
      ...words.map((w) => ({
        id: w.id, kind: 'vocab', front: w.word, back: w.translation,
        context: w.example ? `Словарь · ${w.example}` : 'Словарь',
      })),
    ].slice(0, SESSION_CAP);

    res.json({ data: items, meta: { cards: cards.length, vocab: words.length, total: items.length } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сборки сессии повторения' });
  }
};

// POST /study/review — результат повторения (единый вход для карточек трека и словаря)
const review = async (req, res) => {
  try {
    const { kind, id, correct } = req.body;
    const Model = kind === 'vocab' ? VocabItem : kind === 'card' ? TrackCard : null;
    if (!Model) return res.status(400).json({ error: 'Неизвестный тип карточки' });

    const item = await Model.findOne({ where: { id, userId: req.user.id } });
    if (!item) return res.status(404).json({ error: 'Карточка не найдена' });

    await item.update(computeSr(item.correctStreak, !!correct));
    res.json({ data: { id: item.id, status: item.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
};

module.exports = { session, review, weakSpots };
