const { z } = require('zod');

// POST /homework — создание ДЗ.
// Ровно один из lessonId / individualLessonId (XOR через .refine).
// deadline опционален, но если есть — валидная дата В БУДУЩЕМ.
const createHomework = z.object({
  description:        z.string().trim().min(1, 'Описание обязательно'),
  // Форма шлёт неиспользуемый id как null → принимаем null (XOR ниже трактует его как «нет»)
  lessonId:          z.uuid().nullable().optional(),
  individualLessonId: z.uuid().nullable().optional(),
  quizId:            z.uuid().nullable().optional(), // прикреплённый тест (необязательно)
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
  quizId:      z.uuid().nullable().optional(),
});

// POST /homework/:id/quiz-attempt — прохождение прикреплённого теста (ученик).
// Вопросы/тип берём с сервера из прикреплённого теста; клиент шлёт только ответы и результат.
const quizAttempt = z.object({
  answers: z.any().optional(),
  score:   z.number().int().nullable().optional(),
  total:   z.number().int().nullable().optional(),
});

// POST /homework/:id/submit — сдача. Можно сдать пустую (только коммент или вовсе пусто).
// nullable: фронт шлёт fileUrl:null когда файла нет — это валидное «нет файла».
const submitHomework = z.object({
  fileUrl: z.string().trim().nullable().optional(),
  comment: z.string().trim().nullable().optional(),
});

// PUT /homework/:id/submissions/:subId — оценка 0..100 (целое) или null для сброса в pending.
const gradeSubmission = z.object({
  grade: z.union([
    z.number().int().min(0, 'Оценка 0–100').max(100, 'Оценка 0–100'),
    z.null(),
  ]).optional(),
});

module.exports = { createHomework, updateHomework, submitHomework, gradeSubmission, quizAttempt };
