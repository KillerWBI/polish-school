const { z } = require('zod');

// GET /users/search?username=
const searchUser = z.object({
  username: z.string().trim().min(3, 'username минимум 3 символа'),
});

// POST /groups/:id/invitations — учитель приглашает студента в группу.
const createInvitation = z.object({
  inviteeUserId: z.uuid('Неверный inviteeUserId'),
});

// POST /groups/:id/invitations/bulk — позвать по email тех, кого ещё нет на платформе.
// Нормализуем здесь же: приводим к нижнему регистру и убираем дубли, чтобы контроллер
// не разбирался с «Ivan@mail.ru» и «ivan@mail.ru» как с разными адресами.
const bulkInvitation = z.object({
  emails: z.array(z.string().trim().toLowerCase().pipe(z.email('Неверный email')))
    .min(1, 'Укажите хотя бы один адрес')
    .max(50, 'За раз не больше 50 адресов')
    .transform(list => [...new Set(list)]),
});

// PATCH /invitations/:id — студент принимает или отклоняет.
const patchInvitation = z.object({
  status: z.enum(['accepted', 'declined'], 'status должен быть accepted или declined'),
});

module.exports = { searchUser, createInvitation, bulkInvitation, patchInvitation };
