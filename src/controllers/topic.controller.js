const crypto = require('crypto');
const { Topic, Quiz, TrackSource } = require('../models');
const { generateQuiz, generateRoadmap, gradeOpenAnswers, suggestSources } = require('../services/aiQuiz');
const { verifySources } = require('../utils/verifySources');

// Вес сложности: на лёгких тестах потолок обладания ниже, 100% — только на сложных.
const DIFFICULTY_WEIGHT = { easy: 0.6, medium: 0.8, hard: 1.0 };
const EMA_ALPHA = 0.35; // вес свежей попытки в скользящем среднем

// Сложность следующего теста растёт вместе с обладанием шагом.
const difficultyForMastery = (m) => (m < 40 ? 'easy' : m < 70 ? 'medium' : 'hard');

// Найти шаг в роадмапе по id
const findStep = (roadmap, stepId) =>
  (Array.isArray(roadmap) ? roadmap : []).find((s) => s.id === stepId);

// Средний % обладания темой по её шагам
const topicMasteryFromRoadmap = (roadmap) => {
  const steps = Array.isArray(roadmap) ? roadmap : [];
  if (!steps.length) return 0;
  const sum = steps.reduce((acc, s) => acc + (Number(s.mastery) || 0), 0);
  return Math.round((sum / steps.length) * 10) / 10;
};

// Пересчёт обладания ШАГОМ по результату практики (EMA, вес сложности).
// ratio — доля верного 0..1. Персистит topic. Возвращает обновлённый шаг или null.
const applyStepResult = async (topic, stepId, ratio, difficulty) => {
  const roadmap = Array.isArray(topic.roadmap) ? topic.roadmap.map((s) => ({ ...s })) : [];
  const step = roadmap.find((s) => s.id === stepId);
  if (!step) return null;

  const weight = DIFFICULTY_WEIGHT[difficulty] ?? 0.8;
  const attemptScore = ratio * weight * 100;
  const stepMastery = (step.attempts || 0) === 0
    ? attemptScore
    : (Number(step.mastery) || 0) * (1 - EMA_ALPHA) + attemptScore * EMA_ALPHA;
  step.mastery = Math.round(stepMastery * 10) / 10;
  step.attempts = (step.attempts || 0) + 1;

  await topic.update({
    roadmap,
    masteryPercent: topicMasteryFromRoadmap(roadmap),
    attempts: topic.attempts + 1,
    lastPracticedAt: new Date(),
  });
  return step;
};

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

// GET /topics/:id — тема с роадмапом + история попыток
const getOne = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const attempts = await Quiz.findAll({
      where: { topicId: topic.id },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'stepId', 'difficulty', 'score', 'total', 'createdAt'],
    });

    res.json({ data: { topic, attempts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения темы' });
  }
};

// POST /topics — создать тему (+ сгенерировать роадмап подтем)
const create = async (req, res) => {
  try {
    const { title, subject } = req.body;

    let goal = null;
    let steps = [];
    try {
      const rm = await generateRoadmap({ title, subject, language: 'русский' });
      goal = rm.goal;
      steps = rm.steps;
    } catch (e) {
      // AI недоступен/сбой — тема всё равно рабочая: один шаг = сама тема
      console.warn('generateRoadmap fallback:', e.message);
      steps = [title];
    }

    const roadmap = steps.map((t, i) => ({
      id: crypto.randomUUID(),
      title: t,
      order: i,
      mastery: 0,
      attempts: 0,
    }));

    const topic = await Topic.create({
      userId: req.user.id,
      title,
      subject: subject || null,
      goal,
      roadmap,
    });
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

// POST /topics/:id/next — сгенерировать следующий тест по шагу роадмапа.
// Сложность — по обладанию шагом; анти-повтор — из текстов вопросов последних практик шага.
const next = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId } = req.body || {};
    const type = req.body?.type === 'open' ? 'open' : 'single'; // тип практики: тест или открытый ответ
    const step = findStep(topic.roadmap, stepId);
    if (!step) return res.status(400).json({ error: 'Шаг не найден' });

    const difficulty = difficultyForMastery(Number(step.mastery) || 0);

    // Тексты вопросов последних 3 практик этого шага — чтобы не повторяться
    const recent = await Quiz.findAll({
      where: { topicId: topic.id, stepId },
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

    // Практикуем конкретную подтему в контексте темы
    const quizTopic = step.title === topic.title ? topic.title : `${topic.title} — ${step.title}`;
    const questions = await generateQuiz({
      topic: quizTopic,
      count: type === 'open' ? 3 : 5,
      difficulty,
      type,
      language: 'русский',
      avoid: avoid.slice(0, 15),
    });

    res.json({ data: { topic: quizTopic, stepId, type, difficulty, questions } });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('topic.next:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сгенерировать тест' });
  }
};

// POST /topics/:id/attempt — записать результат практики шага + пересчитать обладание (EMA)
const attempt = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId, questions, answers, score, total, difficulty } = req.body;
    if (score > total) return res.status(400).json({ error: 'score не может превышать total' });
    if (!findStep(topic.roadmap, stepId)) return res.status(400).json({ error: 'Шаг не найден' });

    // Сохраняем практику как Quiz (история для анти-повтора + разбор ошибок)
    await Quiz.create({
      teacherId: req.user.id, // владелец = проходивший
      topicId: topic.id,
      stepId,
      topic: topic.title, type: 'single', difficulty, language: 'русский',
      questions, answers: answers || {}, score, total,
    });

    // Пересчёт обладания шагом (EMA)
    await applyStepResult(topic, stepId, score / total, difficulty);

    res.json({ data: topic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
};

// POST /topics/:id/grade-open — оценить открытые ответы (ИИ) + сохранить попытку + EMA
const gradeOpen = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId, questions, answers, difficulty } = req.body;
    const step = findStep(topic.roadmap, stepId);
    if (!step) return res.status(400).json({ error: 'Шаг не найден' });
    const qs = Array.isArray(questions) ? questions : [];
    if (!qs.length) return res.status(400).json({ error: 'Нет вопросов' });

    const quizTopic = step.title === topic.title ? topic.title : `${topic.title} — ${step.title}`;
    const items = qs.map((q, i) => ({
      question: q.question,
      sampleAnswer: q.sampleAnswer || '',
      answer: (answers && answers[i]) || '',
    }));

    // ИИ-оценка каждого ответа (0..100 + фидбек)
    const results = await gradeOpenAnswers({ topic: quizTopic, language: 'русский', items });
    const total = qs.length;
    const avg = results.reduce((s, r) => s + r.score, 0) / total; // 0..100
    const score = Math.round((avg / 100) * total); // для отображения X/total

    // Сохраняем попытку: фидбек ИИ кладём в explanation каждого вопроса (виден в разборе)
    const questionsWithFeedback = qs.map((q, i) => ({
      ...q,
      explanation: results[i]?.feedback || q.explanation || '',
    }));
    await Quiz.create({
      teacherId: req.user.id,
      topicId: topic.id,
      stepId,
      topic: topic.title, type: 'open', difficulty, language: 'русский',
      questions: questionsWithFeedback, answers: answers || {}, score, total,
    });

    await applyStepResult(topic, stepId, avg / 100, difficulty);

    res.json({ data: { results, avg: Math.round(avg), score, total, topic } });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('topic.gradeOpen:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось оценить ответы' });
  }
};

// GET /topics/:id/sources — сохранённые источники трека (?stepId= фильтр)
const sourcesList = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const where = { userId: req.user.id, topicId: topic.id };
    if (req.query.stepId) where.stepId = req.query.stepId;
    const rows = await TrackSource.findAll({ where, order: [['createdAt', 'ASC']] });
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения источников' });
  }
};

// POST /topics/:id/sources — подобрать источники к шагу (ИИ + проверка), сохранить и вернуть новые.
// Body { stepId, loose? } — loose=true добавляет «менее проверенные» (по запросу пользователя).
const sources = async (req, res) => {
  try {
    const topic = await Topic.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!topic) return res.status(404).json({ error: 'Тема не найдена' });

    const { stepId, loose } = req.body;
    const step = findStep(topic.roadmap, stepId);
    if (!step) return res.status(400).json({ error: 'Шаг не найден' });

    // Уже сохранённые по шагу — чтобы не предлагать повторно (анти-повтор) и не дублировать
    const existing = await TrackSource.findAll({ where: { userId: req.user.id, topicId: topic.id, stepId } });
    const avoid = existing.flatMap((s) => [s.title, s.url].filter(Boolean));
    const existingKeys = new Set(existing.map((s) => (s.url || s.title).toLowerCase()));

    const title = step.title === topic.title ? topic.title : `${topic.title} — ${step.title}`;
    const suggested = await suggestSources({ title, subject: topic.subject, language: 'русский', avoid });
    const checked = await verifySources(suggested, { loose: !!loose });

    // Отсекаем дубли по url/title и сохраняем новые
    const toSave = [];
    const seen = new Set(existingKeys);
    for (const s of checked) {
      const key = (s.url || s.title || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      toSave.push({
        userId: req.user.id, topicId: topic.id, stepId,
        type: s.type, title: s.title, author: s.author || null, url: s.url || null,
        verified: s.verified !== false,
      });
    }
    const created = toSave.length ? await TrackSource.bulkCreate(toSave) : [];
    res.json({ data: created });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('topic.sources:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось подобрать источники' });
  }
};

// DELETE /topics/:id/sources/:sourceId — удалить источник
const removeSource = async (req, res) => {
  try {
    const n = await TrackSource.destroy({
      where: { id: req.params.sourceId, topicId: req.params.id, userId: req.user.id },
    });
    if (!n) return res.status(404).json({ error: 'Источник не найден' });
    res.json({ data: { id: req.params.sourceId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления источника' });
  }
};

module.exports = { list, getOne, create, remove, next, attempt, gradeOpen, sources, sourcesList, removeSource };
