const { z } = require('zod');

// POST /ai/quiz — параметры генерации теста.
const quizSchema = z.object({
  topic:      z.string().trim().min(2, 'Укажите тему (мин. 2 символа)').max(200),
  count:      z.coerce.number().int().min(1).max(20).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  type:       z.enum(['single', 'multiple', 'truefalse', 'open']).default('single'),
  language:   z.string().trim().min(1).max(40).default('русский'),
});

module.exports = { quizSchema };
