const { z } = require('zod');

// POST /attendance — учитель отмечает посещаемость (bulk).
// Нужен ровно один из lessonId / individualLessonId (XOR).
const createAttendance = z.object({
  lessonId:           z.string().uuid().nullable().optional(),
  individualLessonId: z.string().uuid().nullable().optional(),
  records: z.array(
    z.object({
      studentId: z.string().uuid('studentId должен быть UUID'),
      present:   z.boolean({ required_error: 'present обязателен' }),
    })
  ).min(1, 'records не должен быть пустым'),
}).refine(d => !!d.lessonId !== !!d.individualLessonId, {
  message: 'Нужен ровно один из lessonId / individualLessonId',
});

// POST /attendance/:id/confirm — студент подтверждает / оспаривает своё посещение
const confirmAttendance = z.object({
  present: z.boolean({ required_error: 'present обязателен (true/false)' }),
});

// PUT /attendance/:id — учитель разрешает спор
const resolveAttendance = z.object({
  accept: z.boolean({ required_error: 'accept обязателен (true/false)' }),
});

module.exports = { createAttendance, confirmAttendance, resolveAttendance };
