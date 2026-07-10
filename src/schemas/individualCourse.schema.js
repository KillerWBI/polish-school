const { z } = require('zod');

const placeholderSchema = z.object({
  name:    z.string().trim().min(1, 'Имя заглушки обязательно'),
  contact: z.string().trim().max(200).optional(),
});

// POST /individual-courses — создание курса
const createIndividualCourse = z.object({
  studentId:      z.string().uuid().nullable().optional(),
  placeholder:    placeholderSchema.optional(),
  name:           z.string().trim().max(200).nullable().optional(),
  schedule:       z.array(z.any()).optional(),
  lessonLink:     z.string().nullable().optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
});

// PUT /individual-courses/:id — обновление курса
const updateIndividualCourse = z.object({
  name:           z.string().trim().max(200).nullable().optional(),
  schedule:       z.array(z.any()).optional(),
  lessonLink:     z.string().nullable().optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
});

// POST /individual-courses/:id/generate-lessons
const generateLessonsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from: формат YYYY-MM-DD'),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to: формат YYYY-MM-DD'),
});

module.exports = { createIndividualCourse, updateIndividualCourse, generateLessonsSchema };
