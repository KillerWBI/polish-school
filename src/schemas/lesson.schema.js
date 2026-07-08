const { z } = require('zod');

// POST /lessons
const createLesson = z.object({
  groupId:     z.uuid('groupId должен быть валидным UUID'),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date в формате YYYY-MM-DD'),
  time:        z.string().regex(/^\d{2}:\d{2}$/, 'time в формате HH:MM'),
  topic:       z.string().trim().nullish(),
  description: z.string().trim().nullish(),
  lessonLink:  z.string().trim().nullish(),
  materials:   z.array(z.any()).optional(),
});

// PUT /lessons/:id — groupId не меняем; остальное опционально
const updateLesson = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date в формате YYYY-MM-DD').optional(),
  time:        z.string().regex(/^\d{2}:\d{2}$/, 'time в формате HH:MM').optional(),
  topic:       z.string().trim().nullish(),
  description: z.string().trim().nullish(),
  lessonLink:  z.string().trim().nullish(),
  materials:   z.array(z.any()).optional(),
});

module.exports = { createLesson, updateLesson };
