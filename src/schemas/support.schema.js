const { z } = require('zod');

// POST /support/ticket — публичная форма обращения
const createTicket = z.object({
  name:     z.string().trim().min(1, 'Укажите имя').max(100),
  email:    z.string().trim().toLowerCase().pipe(z.email('Некорректный email')),
  subject:  z.string().trim().min(1, 'Укажите тему').max(200),
  category: z.enum(['question', 'problem', 'billing']).optional(),
  message:  z.string().trim().min(1, 'Опишите вопрос').max(5000),
});

// PATCH /admin/support/:id — ответ администратора + смена статуса
const updateTicket = z.object({
  status:     z.enum(['open', 'in_progress', 'resolved']).optional(),
  adminReply: z.string().trim().max(5000).nullable().optional(),
});

module.exports = { createTicket, updateTicket };
