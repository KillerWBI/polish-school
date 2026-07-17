const { z } = require('zod');

// POST /topics — создать тему
const createTopic = z.object({
  title:   z.string().trim().min(1, 'Укажите тему').max(200),
  subject: z.string().trim().max(100).nullable().optional(),
});

// POST /topics/:id/attempt — записать результат практики шага
const submitAttempt = z.object({
  stepId:    z.string().min(1, 'Не указан шаг'),
  questions: z.array(z.any()).min(1, 'Нет вопросов'),
  answers:   z.record(z.any()).optional(),
  score:     z.number().int().min(0),
  total:     z.number().int().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

// POST /topics/:id/cards/generate — сгенерировать карточки шага
const generateCards = z.object({
  stepId: z.string().min(1, 'Не указан шаг'),
  count:  z.number().int().min(4).max(15).optional(),
});

// PATCH /topics/:id/cards/:cardId/review — результат повторения
const reviewCard = z.object({
  correct: z.boolean(),
});

// POST /topics/:id/grade-open — оценить открытые ответы
const gradeOpen = z.object({
  stepId:     z.string().min(1, 'Не указан шаг'),
  questions:  z.array(z.any()).min(1, 'Нет вопросов'),
  answers:    z.record(z.any()).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

// POST /topics/:id/sources — подобрать источники к шагу
const sourcesReq = z.object({
  stepId: z.string().min(1, 'Не указан шаг'),
  loose:  z.boolean().optional(),
});

// POST /topics/:id/cards/from-text — карточки из текста
const cardsFromText = z.object({
  stepId: z.string().min(1, 'Не указан шаг'),
  text:   z.string().min(30, 'Слишком короткий текст').max(20000),
  count:  z.number().int().min(4).max(20).optional(),
});

module.exports = { createTopic, submitAttempt, generateCards, reviewCard, gradeOpen, sourcesReq, cardsFromText };
