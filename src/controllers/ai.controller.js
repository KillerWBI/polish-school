const { generateQuiz } = require('../services/aiQuiz');
const { enforceAi } = require('../utils/aiLimit');

// POST /ai/quiz — сгенерировать тест по теме (обе роли). Дневной лимит ИИ по роли/тарифу.
const quiz = async (req, res) => {
  try {
    if (await enforceAi(res, req.user.id, req.user.role)) return;
    const questions = await generateQuiz(req.body);
    res.json({ data: { ...req.body, questions } });
  } catch (err) {
    if (err.code === 'NO_AI_KEY') {
      return res.status(503).json({ error: 'AI не настроен: добавьте AI_API_KEY в .env бэкенда' });
    }
    console.error('AI quiz error:', err.message);
    res.status(502).json({ error: err.message || 'Не удалось сгенерировать тест' });
  }
};

module.exports = { quiz };
