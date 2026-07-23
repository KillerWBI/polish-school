const { z } = require('zod');

// ISO-код языка ('en','pl','uk','pt-br'…). Пустой не принимаем, длинные — тоже.
const langCode = z.string().trim().min(2).max(10);

// POST /vocab — добавить слово (+ языки: изучаемый и родной)
const createVocab = z.object({
  word:           z.string().trim().min(1, 'Введите слово').max(200),
  translation:    z.string().trim().min(1, 'Введите перевод').max(200),
  example:        z.string().trim().max(1000).nullable().optional(),
  language:       langCode.nullable().optional(),
  nativeLanguage: langCode.nullable().optional(),
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

// POST /vocab/bulk — массовое добавление (из вставки «слово — перевод»)
const bulkVocab = z.object({
  items: z.array(z.object({
    word:        z.string().trim().min(1).max(200),
    translation: z.string().trim().min(1).max(200),
    example:     z.string().trim().max(1000).nullable().optional(),
  })).min(1, 'Добавьте хотя бы одну пару').max(500, 'Слишком много за раз (максимум 500)'),
  language:       langCode.nullable().optional(),
  nativeLanguage: langCode.nullable().optional(),
});

// POST /vocab/generate — сгенерировать набор слов ИИ
const generateVocabReq = z.object({
  language:       langCode,
  nativeLanguage: langCode,
  topic:          z.string().trim().min(1, 'Укажите тему').max(200),
  count:          z.number().int().min(1).max(100),
  level:          z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

module.exports = { createVocab, updateVocab, reviewVocab, bulkVocab, generateVocabReq };
