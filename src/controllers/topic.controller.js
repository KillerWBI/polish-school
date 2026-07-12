const { Topic, Quiz } = require('../models');
const { generateQuiz } = require('../services/aiQuiz');

// Вес сложности: на лёгких тестах потолок обладания ниже, 100% — только на сложных.
const DIFFICULTY_WEIGHT = { easy: 0.6, medium: 0.8, hard: 1.0 };
const EMA_ALPHA = 0.35; // вес свежей попытки в скользящем среднем

// Сложность следующего теста растёт вместе с обладанием темой.
const difficultyForMastery = (m) => (m < 40 ? 'easy' : m < 70 ? 'medium' : 'hard');

// GET /topics — мои темы (с обладанием и числом практик)
const list = async (req, res) => {
  try {
    const topics = await Topic.findAll({
      where: { userId: req.user.id },
      order: [['updatedAt', 'DESC']], // недавно практикованные/созданные — выше
    });
    res.json({ data: topics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения тем' });
  }
};

// POST /topics — создать тему
const create = async (req, res) => {
  try {
    const { title, subject } = req.body;
    const topic = await Topic.create({ userId: req.user.id, title, subject: subject || null });
    res.status(201).json({ data: topic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания темы' });
  }
};

// DELETE /topics/:id — удалить тему (её попытки удалятся каскадом по FK)
const remove = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });
    await topic.destroy();
    res.json({ data: { id: topic.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления темы' });
  }
};

// POST /topics/:id/next — сгенерировать следующий тест по теме.
// Сложность — по обладанию; анти-повтор — из текстов вопросов последних практик.
const next = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const difficulty = difficultyForMastery(topic.masteryPercent);

    // Собираем тексты вопросов последних 3 практик, чтобы не повторяться
    const recent = await Quiz.findAll({
      where: { topicId: topic.id },
      order: [['createdAt', 'DESC']],
      limit: 3,
      attributes: ['questions'],
    });
    const avoid = [];
    for (const q of recent) {
      for (const item of (Array.isArray(q.questions) ? q.questions : [])) {
        if (item?.question) avoid.push(item.question);
      }
    }

    const questions = await generateQuiz({
      topic: topic.title,
      count: 5,
      difficulty,
      type: 'single',
      language: 'русский',
      avoid: avoid.slice(0, 15),
    });

    res.json({ data: { topic: topic.title, type: 'single', difficulty, questions } });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('topic.next:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сгенерировать тест' });
  }
};

// POST /topics/:id/attempt — записать результат практики + пересчитать обладание (EMA)
const attempt = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { questions, answers, score, total, difficulty } = req.body;
    if (score > total) return res.status(400).json({ error: 'score не может превышать total' });

    // Сохраняем практику как Quiz (история для анти-повтора + аналитика)
    await Quiz.create({
      teacherId: req.user.id, // владелец = проходивший
      topicId: topic.id,
      topic: topic.title, type: 'single', difficulty, language: 'русский',
      questions, answers: answers || {}, score, total,
    });

    // Результат попытки в шкале 0..100 с учётом сложности
    const weight = DIFFICULTY_WEIGHT[difficulty] ?? 0.8;
    const attemptScore = (score / total) * weight * 100;

    // EMA: первая попытка задаёт базу, далее — скользящее среднее (текущий уровень «по факту»)
    const mastery = topic.attempts === 0
      ? attemptScore
      : topic.masteryPercent * (1 - EMA_ALPHA) + attemptScore * EMA_ALPHA;

    await topic.update({
      masteryPercent: Math.round(mastery * 10) / 10,
      attempts: topic.attempts + 1,
      lastPracticedAt: new Date(),
    });

    res.json({ data: topic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
};

module.exports = { list, create, remove, next, attempt };
