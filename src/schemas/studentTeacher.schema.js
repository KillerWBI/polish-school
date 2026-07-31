const { z } = require('zod');

// POST /student-teachers — завести карточку «моего преподавателя»
const createStudentTeacher = z.object({
  name:           z.string().trim().min(1, 'Укажите имя').max(100),
  subject:        z.string().trim().min(1, 'Укажите предмет').max(100),
  pricePerLesson: z.coerce.number().min(0).optional(),
  contact:        z.string().trim().max(200).nullable().optional(),
  notes:          z.string().trim().max(2000).nullable().optional(),
});

// PUT /student-teachers/:id
const updateStudentTeacher = z.object({
  name:           z.string().trim().min(1).max(100).optional(),
  subject:        z.string().trim().min(1).max(100).optional(),
  pricePerLesson: z.coerce.number().min(0).optional(),
  contact:        z.string().trim().max(200).nullable().optional(),
  notes:          z.string().trim().max(2000).nullable().optional(),
});

module.exports = { createStudentTeacher, updateStudentTeacher };
