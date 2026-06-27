const { z } = require('zod');

// GET /users/search?username=
const searchUser = z.object({
  username: z.string().trim().min(3, 'username минимум 3 символа'),
});

// POST /groups/:id/invitations — учитель приглашает студента в группу.
const createInvitation = z.object({
  inviteeUserId: z.uuid('Неверный inviteeUserId'),
});

// PATCH /invitations/:id — студент принимает или отклоняет.
const patchInvitation = z.object({
  status: z.enum(['accepted', 'declined'], 'status должен быть accepted или declined'),
});

module.exports = { searchUser, createInvitation, patchInvitation };
