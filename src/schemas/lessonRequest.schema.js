const { z } = require('zod');

// POST /lesson-requests — студент создаёт заявку на обучение.
// Контакт (method+value) обязателен: фронт подставляет из профиля или просит ввести.
const createLessonRequest = z.object({
  teacherId:     z.uuid('Неверный teacherId'),
  language:      z.string().trim().min(1, 'Укажите язык'),
  level:         z.string().trim().max(20).optional(),
  message:       z.string().trim().max(1000).optional(),
  contactMethod: z.enum(['telegram', 'whatsapp', 'instagram', 'phone'], 'Неверный способ связи'),
  contactValue:  z.string().trim().min(1, 'Укажите контакт'),
});

// PATCH /lesson-requests/:id — учитель принимает или отклоняет.
const patchLessonRequest = z.object({
  status: z.enum(['accepted', 'declined'], 'status должен быть accepted или declined'),
});

module.exports = { createLessonRequest, patchLessonRequest };
