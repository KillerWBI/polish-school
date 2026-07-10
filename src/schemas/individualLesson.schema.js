const { z } = require('zod');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const placeholderSchema = z.object({
  name:    z.string().trim().min(1, 'Имя заглушки обязательно'),
  contact: z.string().trim().max(200).optional(),
});

// POST /individual-lessons — создание урока
const createIndividualLesson = z.object({
  date:               z.string().regex(DATE_RE, 'date: формат YYYY-MM-DD'),
  time:               z.string().regex(TIME_RE, 'time: формат HH:MM'),
  studentId:          z.string().uuid().nullable().optional(),
  placeholder:        placeholderSchema.optional(),
  individualCourseId: z.string().uuid().nullable().optional(),
  topic:              z.string().trim().max(500).nullable().optional(),
  description:        z.string().trim().max(2000).nullable().optional(),
  lessonLink:         z.string().nullable().optional(),
  pricePerLesson:     z.coerce.number().min(0).optional(),
  materials:          z.any().optional(),
});

// PUT /individual-lessons/:id — обновление урока
const updateIndividualLesson = z.object({
  date:           z.string().regex(DATE_RE, 'date: формат YYYY-MM-DD').optional(),
  time:           z.string().regex(TIME_RE, 'time: формат HH:MM').optional(),
  topic:          z.string().trim().max(500).nullable().optional(),
  description:    z.string().trim().max(2000).nullable().optional(),
  lessonLink:     z.string().nullable().optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
  materials:      z.any().optional(),
});

module.exports = { createIndividualLesson, updateIndividualLesson };
