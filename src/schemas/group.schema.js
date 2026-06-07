const { z } = require('zod');

// Слот расписания: {day: 0..6, time: "HH:mm"}  (0=Вс ... 6=Сб)
const scheduleSlot = z.object({
  day:  z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time слота в формате HH:MM'),
});

// POST /groups
const createGroup = z.object({
  name:           z.string().trim().min(1, 'Название обязательно'),
  schedule:       z.array(scheduleSlot).optional(),
  lessonLink:     z.string().trim().optional(),
  pricePerLesson: z.coerce.number().min(0, 'Цена не может быть отрицательной').optional(),
});

// PUT /groups/:id — все поля опциональны
const updateGroup = z.object({
  name:           z.string().trim().min(1, 'Название не может быть пустым').optional(),
  schedule:       z.array(scheduleSlot).optional(),
  lessonLink:     z.string().trim().optional(),
  pricePerLesson: z.coerce.number().min(0, 'Цена не может быть отрицательной').optional(),
});

// POST /groups/:id/students
const addStudent = z.object({
  studentId: z.uuid('studentId должен быть валидным UUID'),
});

module.exports = { createGroup, updateGroup, addStudent };
