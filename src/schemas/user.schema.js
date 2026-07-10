const { z } = require('zod');

// PUT /users/:id — обновление имени (только name)
const updateUser = z.object({
  name: z.string().trim().min(1, 'Имя обязательно').max(100, 'Имя слишком длинное'),
});

// PUT /users/me/profile — полноценное обновление профиля
const updateProfile = z.object({
  name:             z.string().trim().min(1).max(100).optional(),
  username:         z.string().trim().min(3).max(40).optional(),
  bio:              z.string().trim().max(300, 'Bio не должно превышать 300 символов').nullable().optional(),
  avatar:           z.string().nullable().optional(),
  coverImage:       z.string().nullable().optional(),
  phone:            z.string().trim().max(30).nullable().optional(),
  socialTelegram:   z.string().trim().max(100).nullable().optional(),
  socialWhatsApp:   z.string().trim().max(100).nullable().optional(),
  socialLinkedIn:   z.string().trim().max(200).nullable().optional(),
  socialInstagram:  z.string().trim().max(100).nullable().optional(),
  languages: z.array(
    z.object({
      code:  z.string().trim().min(2).max(10),
      level: z.string().trim().optional(),
    })
  ).optional(),
  paymentDetails: z.record(z.any()).nullable().optional(),
});

module.exports = { updateUser, updateProfile };
