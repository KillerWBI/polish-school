const { z } = require('zod');

// POST /notes — создать заметку
const createNote = z.object({
  lessonId:           z.string().uuid().nullable().optional(),
  individualLessonId: z.string().uuid().nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  text:  z.string().trim().min(1, 'Заметка не может быть пустой').max(5000),
});

// PUT /notes/:id — редактировать
const updateNote = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  text:  z.string().trim().min(1).max(5000).optional(),
});

module.exports = { createNote, updateNote };
