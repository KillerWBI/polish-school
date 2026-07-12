const { z } = require('zod');

// POST /topics — создать тему
const createTopic = z.object({
  title:   z.string().trim().min(1, 'Укажите тему').max(200),
  subject: z.string().trim().max(100).nullable().optional(),
});

// POST /topics/:id/attempt — записать результат практики
const submitAttempt = z.object({
  questions: z.array(z.any()).min(1, 'Нет вопросов'),
  answers:   z.record(z.any()).optional(),
  score:     z.number().int().min(0),
  total:     z.number().int().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

module.exports = { createTopic, submitAttempt };
