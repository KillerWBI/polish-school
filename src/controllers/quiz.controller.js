const { Quiz } = require('../models');

// POST /quizzes — сохранить тест
const create = async (req, res) => {
  try {
    const { topic, type, difficulty, language, questions, answers, score, total } = req.body;
    const quiz = await Quiz.create({
      teacherId: req.user.id, topic, type, difficulty, language, questions,
      answers: answers || {}, score: score ?? null, total: total ?? null,
    });
    res.status(201).json({ data: quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения теста' });
  }
};

// GET /quizzes — мои тесты (мета + число вопросов, без тела вопросов)
const list = async (req, res) => {
  try {
    const quizzes = await Quiz.findAll({
      where: { teacherId: req.user.id },
      order: [['createdAt', 'DESC']],
    });
    const data = quizzes.map((q) => ({
      id: q.id,
      topic: q.topic,
      type: q.type,
      difficulty: q.difficulty,
      language: q.language,
      count: Array.isArray(q.questions) ? q.questions.length : 0,
      score: q.score,
      total: q.total,
      // Пройденный (с ответами/оценкой) vs сохранённый в библиотеку (без прохождения)
      taken: q.score != null || (q.answers && Object.keys(q.answers).length > 0),
      createdAt: q.createdAt,
    }));
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения тестов' });
  }
};

// GET /quizzes/:id — полный тест (с вопросами), только свой
const getOne = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ where: { id: req.params.id, teacherId: req.user.id } });
    if (!quiz) return res.status(404).json({ error: 'Тест не найден' });
    res.json({ data: quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения теста' });
  }
};

// DELETE /quizzes/:id — удалить свой тест
const remove = async (req, res) => {
  try {
    const n = await Quiz.destroy({ where: { id: req.params.id, teacherId: req.user.id } });
    if (!n) return res.status(404).json({ error: 'Тест не найден' });
    res.json({ data: { message: 'Тест удалён' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления теста' });
  }
};

module.exports = { create, list, getOne, remove };
