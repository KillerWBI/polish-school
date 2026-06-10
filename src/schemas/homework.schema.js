const { z } = require('zod');

// POST /homework — создание ДЗ.
// Ровно один из lessonId / individualLessonId (XOR через .refine).
// deadline опционален, но если есть — валидная дата В БУДУЩЕМ.
const createHomework = z.object({
  description:        z.string().trim().min(1, 'Описание обязательно'),
  lessonId:          z.uuid().optional(),
  individualLessonId: z.uuid().optional(),
  deadline:          z.coerce.date()
                       .refine(d => d >= new Date(), 'Дата окончания должна быть в будущем')
                       .optional(),
}).refine(d => !!d.lessonId !== !!d.individualLessonId, {
  message: 'Нужен ровно один из lessonId / individualLessonId',
});

// PUT /homework/:id — правка. Оба поля опциональны.
// На update НЕ требуем будущую дату: учитель может чинить старое ДЗ.
const updateHomework = z.object({
  description: z.string().trim().min(1, 'Описание не может быть пустым').optional(),
  deadline:    z.coerce.date().optional(),
});

// POST /homework/:id/submit — сдача. Можно сдать пустую (только коммент).
const submitHomework = z.object({
  fileUrl: z.string().trim().optional(),
  comment: z.string().trim().optional(),
});

// PUT /homework/:id/submissions/:subId — оценка 0..100 (целое) или null для сброса в pending.
const gradeSubmission = z.object({
  grade: z.union([
    z.number().int().min(0, 'Оценка 0–100').max(100, 'Оценка 0–100'),
    z.null(),
  ]).optional(),
});

module.exports = { createHomework, updateHomework, submitHomework, gradeSubmission };
