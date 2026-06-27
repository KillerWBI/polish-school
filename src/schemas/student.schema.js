const { z } = require('zod');

// POST /students/:id/merge — перенести заглушку на реального ученика
const mergeStudent = z.object({
  targetStudentId: z.uuid('targetStudentId должен быть валидным UUID'),
});

module.exports = { mergeStudent };
