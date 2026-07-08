const { z } = require('zod');

// POST /quizzes — сохранить сгенерированный тест.
const createQuizSchema = z.object({
  topic:      z.string().trim().min(1, 'Нужна тема').max(200),
  type:       z.enum(['single', 'multiple', 'truefalse', 'open']).default('single'),
  difficulty: z.string().trim().max(20).optional(),
  language:   z.string().trim().max(40).optional(),
  questions: z.array(z.object({
    question:     z.string(),
    options:      z.array(z.string()).optional(),
    answer:       z.array(z.number()).optional(),
    sampleAnswer: z.string().optional(),
    explanation:  z.string().optional(),
  })).min(1, 'Тест пуст'),
  // Прохождение: ответы пользователя + результат (необязательны — можно сохранить и без прохождения)
  answers: z.any().optional(),
  score:   z.number().int().nullable().optional(),
  total:   z.number().int().nullable().optional(),
});

module.exports = { createQuizSchema };
