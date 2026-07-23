const { z } = require('zod');

// POST /students/:id/merge — перенести заглушку на реального ученика
const mergeStudent = z.object({
  targetStudentId: z.uuid('targetStudentId должен быть валидным UUID'),
});

// POST /students/:id/targeted-quiz — адресный тест по выбранным слабым подтемам ученика
const targetedQuiz = z.object({
  spots: z.array(z.object({
    topicId:   z.uuid(),
    stepTitle: z.string().min(1),
  })).min(1, 'Выберите хотя бы одну слабую тему'),
  count: z.number().int().min(3).max(12).optional(),
});

module.exports = { mergeStudent, targetedQuiz };
