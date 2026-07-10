const { z } = require('zod');

// POST /vocab — добавить слово
const createVocab = z.object({
  word:        z.string().trim().min(1, 'Введите слово').max(200),
  translation: z.string().trim().min(1, 'Введите перевод').max(200),
  example:     z.string().trim().max(1000).nullable().optional(),
});

// PUT /vocab/:id — редактировать
const updateVocab = z.object({
  word:        z.string().trim().min(1).max(200).optional(),
  translation: z.string().trim().min(1).max(200).optional(),
  example:     z.string().trim().max(1000).nullable().optional(),
});

// PATCH /vocab/:id/review — результат повторения
const reviewVocab = z.object({
  correct: z.boolean({ required_error: 'correct обязателен (true/false)' }),
});

module.exports = { createVocab, updateVocab, reviewVocab };
